import { NextResponse } from "next/server"
import crypto from "crypto"
import mongoose from "mongoose"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/jwt"
import connectDB from "@/lib/mongodb"
import Order from "@/models/order"
import Coupon from "@/models/Coupons"
import { sendOrderConfirmationEmail } from "@/lib/email-service"
import { sendOrderConfirmationWhatsApp } from "@/lib/whatsapp-service"
import { withCountryCode } from "@/lib/phone"

export const runtime = "nodejs"

interface CartItemPayload {
  id?: string
  productId?: string
  name: string
  image?: string
  slug?: string
  quantity: number
  price: number
  size?: string
  fabric?: string
  productColor?: string
  productColorHex?: string
}

const buildFullAddress = (address?: {
  houseNumber?: string
  crossStreet?: string
  locality?: string
  landmark?: string
  address?: string
}) => {
  const structuredAddress = [address?.houseNumber, address?.crossStreet, address?.locality, address?.landmark]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ")

  if (structuredAddress) return structuredAddress
  return address?.address?.trim() || ""
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    const decoded = token ? verifyToken(token) : null
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { success: false, message: "Razorpay is not configured. Add RAZORPAY_KEY_SECRET." },
        { status: 500 },
      )
    }

const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      customer,
      shippingAddress,
      billingAddress,
      gstDetails,
      items,
      subtotal,
      shippingCost,
      discount,
      totalAmount,
      paymentMethod,
      appliedCoupons,
    } = await request.json()

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ success: false, message: "Missing payment details." }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "Order must include at least one item." }, { status: 400 })
    }

    const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(signaturePayload)
      .digest("hex")

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ success: false, message: "Invalid payment signature." }, { status: 400 })
    }

    await connectDB()

    const parseCouponCodes = (raw: unknown): string[] => {
      if (typeof raw !== "string" || !raw.trim()) return []
      return raw
        .split(",")
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    }

    const computeExpectedDiscount = (coupon: {
      type: string
      discount: number
      maxDiscount?: number
    }, lineSubtotal: number): number => {
      let discountAmount = 0
      if (coupon.type === "percentage") {
        discountAmount = (lineSubtotal * coupon.discount) / 100
        if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
          discountAmount = coupon.maxDiscount
        }
      } else if (coupon.type === "fixed") {
        discountAmount = coupon.discount
      }
      return Math.round(discountAmount * 100) / 100
    }

    // Convert userId string to MongoDB ObjectId
    const customerId = new mongoose.Types.ObjectId(decoded.userId)

    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const orderItems = Array.isArray(items)
      ? (items as CartItemPayload[]).map((item) => {
          const lineId = item.id?.trim() || ""
          const explicitProductId = item.productId?.trim() || ""
          const objectIdFromLine = lineId.match(/[a-f0-9]{24}/i)?.[0]
          const productId =
            (explicitProductId && /^[a-f0-9]{24}$/i.test(explicitProductId) ? explicitProductId : null) ||
            objectIdFromLine ||
            explicitProductId ||
            lineId

          const image =
            typeof item.image === "string" && item.image.trim() && item.image !== "/placeholder.svg"
              ? item.image.trim()
              : item.image?.trim() || ""

          return {
          productId,
          productName: item.name,
          productImage: image || undefined,
          productSlug: item.slug,
          quantity: item.quantity,
          price: item.price,
          size: item.size,
          fabric: item.fabric,
          productColor: item.productColor,
          productColorHex: item.productColorHex,
        }
        })
      : []

    const lineSubtotal = orderItems.reduce(
      (sum, row) => sum + Number(row.price || 0) * Number(row.quantity || 0),
      0,
    )
    const claimedSubtotal = Number(subtotal) || 0
    if (Math.abs(lineSubtotal - claimedSubtotal) > 0.05) {
      return NextResponse.json(
        { success: false, message: "Order subtotal does not match cart items." },
        { status: 400 },
      )
    }

    const couponCodes = parseCouponCodes(appliedCoupons)
    const claimedDiscount = Number(discount) || 0
    let couponCodeStored: string | null = null
    let couponAgentId: mongoose.Types.ObjectId | undefined

    if (claimedDiscount > 0) {
      if (couponCodes.length === 0) {
        return NextResponse.json(
          { success: false, message: "Discount applied without a coupon code." },
          { status: 400 },
        )
      }
      const primaryCode = couponCodes[0]
      const couponDoc = await Coupon.findOne({
        code: primaryCode,
        status: "active",
      })
      if (!couponDoc) {
        return NextResponse.json(
          { success: false, message: "Invalid coupon used for this order." },
          { status: 400 },
        )
      }
      if (new Date(couponDoc.expiryDate) < new Date()) {
        return NextResponse.json(
          { success: false, message: "Coupon has expired." },
          { status: 400 },
        )
      }
      if (couponDoc.usedCount >= couponDoc.usageLimit) {
        return NextResponse.json(
          { success: false, message: "Coupon usage limit reached." },
          { status: 400 },
        )
      }
      if (claimedSubtotal < couponDoc.minPurchase) {
        return NextResponse.json(
          { success: false, message: "Cart does not meet coupon minimum purchase." },
          { status: 400 },
        )
      }
      const expectedDisc = computeExpectedDiscount(couponDoc, claimedSubtotal)
      if (Math.abs(expectedDisc - claimedDiscount) > 0.05) {
        return NextResponse.json(
          { success: false, message: "Discount amount does not match coupon rules." },
          { status: 400 },
        )
      }
      couponCodeStored = couponCodes.join(", ")
      const agents = couponDoc.agents
      if (Array.isArray(agents) && agents.length > 0 && mongoose.Types.ObjectId.isValid(agents[0])) {
        couponAgentId = new mongoose.Types.ObjectId(agents[0])
      }
    } else if (couponCodes.length > 0) {
      return NextResponse.json(
        { success: false, message: "Coupon codes provided but no discount was applied." },
        { status: 400 },
      )
    }

    const shippingNum = Number(shippingCost) || 0
    const expectedTotal = Math.round((claimedSubtotal - claimedDiscount + shippingNum) * 100) / 100
    const claimedTotal = Number(totalAmount) || 0
    if (Math.abs(expectedTotal - claimedTotal) > 0.05) {
      return NextResponse.json(
        { success: false, message: "Order total does not match subtotal, discount, and shipping." },
        { status: 400 },
      )
    }

    const order = await Order.create({
      orderId,
      customerId: customerId, // Store the authenticated user's ObjectId
      customerName: `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim(),
      customerEmail: customer?.email || "",
      customerPhone: customer?.phone ? withCountryCode(customer.phone) : "",
shippingAddress: {
        houseNumber: shippingAddress?.houseNumber || "",
        crossStreet: shippingAddress?.crossStreet || "",
        locality: shippingAddress?.locality || "",
        landmark: shippingAddress?.landmark || "",
        fullAddress: buildFullAddress(shippingAddress),
        city: shippingAddress?.city || "",
        state: shippingAddress?.state || "",
        zipCode: shippingAddress?.zipCode || "",
        country: shippingAddress?.country || "India",
      },
      billingAddress: billingAddress ? {
        firstName: billingAddress.firstName || "",
        lastName: billingAddress.lastName || "",
        houseNumber: billingAddress.houseNumber || "",
        crossStreet: billingAddress.crossStreet || "",
        locality: billingAddress.locality || "",
        landmark: billingAddress.landmark || "",
        fullAddress: buildFullAddress(billingAddress),
        city: billingAddress.city || "",
        state: billingAddress.state || "",
        zipCode: billingAddress.zipCode || "",
        country: billingAddress.country || "India",
      } : null,
      gstDetails: gstDetails ? {
        gstNumber: gstDetails.gstNumber || "",
        companyName: gstDetails.companyName || "",
      } : null,
      items: orderItems,
      subtotal: Number(subtotal) || 0,
      shippingCost: Number(shippingCost) || 0,
      discount: Number(discount) || 0,
      couponCode: couponCodeStored,
      couponAgentId,
      totalAmount: Number(totalAmount) || 0,
      paymentMethod: paymentMethod || "razorpay",
      paymentStatus: "completed",
      orderStatus: "order_processing",
      orderTimeline: [
        {
          status: "order_processing",
          description: "Payment confirmed via Razorpay.",
        },
      ],
      paymentGateway: "razorpay",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    })

    if (couponCodes.length > 0 && claimedDiscount > 0) {
      const updated = await Coupon.findOneAndUpdate(
        {
          code: couponCodes[0],
          status: "active",
          $expr: { $lt: ["$usedCount", "$usageLimit"] },
        },
        { $inc: { usedCount: 1 } },
        { new: true },
      )
      if (!updated) {
        console.warn(
          `[v0] Coupon increment failed for code ${couponCodes[0]} after order ${order.orderId}`,
        )
      }
    }

    // Send order confirmation email
    try {
      const emailSent = await sendOrderConfirmationEmail({
        orderId: order.orderId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount,
        shippingCost: order.shippingCost,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
      })
      console.log(`[v0] Order confirmation email ${emailSent ? "sent" : "failed to send"} for order ${order.orderId}`)
      await sendOrderConfirmationWhatsApp({
        phone: order.customerPhone,
        customerName: order.customerName,
        orderId: order.orderId,
        totalAmount: order.totalAmount,
      })
    } catch (emailError) {
      console.error(`[v0] Error sending order confirmation email: ${emailError}`)
      // Don't fail the order creation if email fails - it's not critical
    }

    return NextResponse.json({ success: true, orderId: order.orderId }, { status: 200 })
  } catch (error: any) {
    console.error("[v0] RAZORPAY_VERIFY_ERROR:", error)
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to verify Razorpay payment." },
      { status: 500 },
    )
  }
}
