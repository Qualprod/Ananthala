import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken } from "@/lib/jwt"
import connectDB from "@/lib/mongodb"
import Order from "@/models/order"
import { sendOrderConfirmationEmail } from "@/lib/email-service"
import { sendOrderConfirmationWhatsApp } from "@/lib/whatsapp-service"

export const runtime = "nodejs"

/**
 * POST /api/emails/order-confirmation
 * Send order confirmation email for an existing order
 * Can be used to resend confirmation emails
 */
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    const decoded = token ? verifyToken(token) : null

    // Optional: Verify authentication for admin or the order owner
    if (!decoded) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 })
    }

    const { orderId } = await request.json()

    if (!orderId) {
      return NextResponse.json({ success: false, message: "Order ID is required" }, { status: 400 })
    }

    await connectDB()

    // Fetch the order from database
    const order = await Order.findOne({ orderId }).lean()

    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 })
    }

    // Verify user is the order owner or admin
    // For now, we'll allow any authenticated user to request confirmation emails
    // In production, add more security checks

    // Send confirmation email
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

    await sendOrderConfirmationWhatsApp({
      phone: order.customerPhone,
      customerName: order.customerName,
      orderId: order.orderId,
      totalAmount: order.totalAmount,
    })

    if (emailSent) {
      return NextResponse.json(
        { success: true, message: "Order confirmation email sent successfully" },
        { status: 200 },
      )
    } else {
      return NextResponse.json(
        { success: false, message: "Failed to send order confirmation email" },
        { status: 500 },
      )
    }
  } catch (error: any) {
    console.error("[v0] ORDER_CONFIRMATION_EMAIL_ERROR:", error)
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to send order confirmation email" },
      { status: 500 },
    )
  }
}
