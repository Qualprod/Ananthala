import { type NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "@/lib/jwt"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/order"
import Product from "@/models/Product"
import { sendOrderStatusUpdateEmail } from "@/lib/email-service"
import { sendOrderStatusWhatsApp } from "@/lib/whatsapp-service"

// Helper function to reduce product stock when order is delivered
async function reduceProductStock(order: any) {
  try {
    console.log("[v0] Reducing stock for delivered order:", order.orderId)
    
    for (const item of order.items) {
      if (!item.productId) continue

      const product = await Product.findById(item.productId)
      if (!product) {
        console.warn(`[v0] Product not found for item in order ${order.orderId}:`, item.productId)
        continue
      }

      // Handle single products with variants (fabric-based)
      if (product.productType === "single") {
        const variant = product.variants.find(
          (v: any) => v.fabric === item.fabric
        )

        if (variant) {
          const newStock = Math.max(0, variant.stock - item.quantity)
          console.log(
            `[v0] Reducing ${product.productTitle} (${item.fabric}) stock from ${variant.stock} to ${newStock}`
          )

          await Product.findByIdAndUpdate(
            item.productId,
            {
              $inc: {
                "variants.$[elem].stock": -item.quantity,
              },
            },
            {
              arrayFilters: [{ "elem.fabric": item.fabric }],
              new: true,
            }
          )
        }
      }
      // Handle hamper products
      else if (product.productType === "hamper") {
        // For hampers, reduce stock from hamper items based on product color/variant
        // This assumes hamper items also have stock tracking
        const hamperItems = product.hamperItems || []
        
        for (const hamperItem of hamperItems) {
          // Find matching hamper item variant by checking available variants
          if (hamperItem.variants && hamperItem.variants.length > 0) {
            const firstVariant = hamperItem.variants[0]
            const newStock = Math.max(0, firstVariant.stock - item.quantity)
            
            console.log(
              `[v0] Reducing hamper item ${hamperItem.name} stock from ${firstVariant.stock} to ${newStock}`
            )

            // Update the first variant of the hamper item
            const itemIndex = hamperItems.indexOf(hamperItem)
            await Product.findByIdAndUpdate(
              item.productId,
              {
                $inc: {
                  [`hamperItems.${itemIndex}.variants.0.stock`]: -item.quantity,
                },
              },
              { new: true }
            )
          }
        }
      }
    }

    console.log("[v0] Stock reduction completed for order:", order.orderId)
  } catch (error) {
    console.error("[v0] Error reducing product stock:", error)
    // Don't fail the API call if stock reduction fails
    // This ensures order status update completes even if stock update has issues
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("admin_token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded = jwtVerify(token)
    if (!decoded || decoded.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    await connectDB()

    const order = await Order.findById(id).lean()

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ order }, { status: 200 })
  } catch (error) {
    console.error("Order details error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = request.cookies.get("admin_token")?.value

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decoded = jwtVerify(token)
    if (!decoded || decoded.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    await connectDB()

    const { orderStatus, trackingNumber, notes, paymentStatus } = await request.json()

    // Validate orderStatus
    const validStatuses = ["pending", "processing", "shipped", "in-transit", "delivered", "cancelled", "payment_failed"]
    if (orderStatus && !validStatuses.includes(orderStatus)) {
      return NextResponse.json({ error: "Invalid order status" }, { status: 400 })
    }

    // Validate tracking number is required for shipping statuses
    const shippingStatuses = ["shipped", "in-transit", "delivered"]
    if (orderStatus && shippingStatuses.includes(orderStatus) && !trackingNumber?.trim()) {
      return NextResponse.json(
        { error: "Tracking number is required for shipping status updates (Shipped, In Transit, Delivered)" },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (orderStatus) updateData.orderStatus = orderStatus
    if (trackingNumber) updateData.trackingNumber = trackingNumber
    if (notes) updateData.notes = notes
    if (paymentStatus) updateData.paymentStatus = paymentStatus

    // Build timeline entry
    const timelineEntry = {
      status: orderStatus || "unknown",
      timestamp: new Date(),
      description: notes || `Order status updated to ${orderStatus}`,
    }

    const order = await Order.findByIdAndUpdate(
      id,
      {
        ...updateData,
        $push: {
          orderTimeline: timelineEntry,
        },
      },
      { new: true },
    )

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Reduce product stock if order is being marked as delivered
    if (orderStatus === "delivered") {
      console.log("[v0] Order marked as delivered, reducing stock")
      await reduceProductStock(order)
    }

    // Send status update email if orderStatus was changed
    if (orderStatus) {
      try {
        console.log(`[v0] Sending status update email for order ${order.orderId}`)
        const emailSent = await sendOrderStatusUpdateEmail({
          orderId: order.orderId,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          newStatus: orderStatus,
          trackingNumber: trackingNumber || order.trackingNumber,
          notes: notes || undefined,
          totalAmount: order.totalAmount,
          items: order.items,
        })
        console.log(`[v0] Status update email ${emailSent ? "sent" : "failed to send"} for order ${order.orderId}`)
        await sendOrderStatusWhatsApp({
          phone: order.customerPhone,
          customerName: order.customerName,
          orderId: order.orderId,
          status: orderStatus,
          trackingNumber: trackingNumber || order.trackingNumber,
        })
      } catch (emailError) {
        console.error(`[v0] Error sending status update email: ${emailError}`)
        // Don't fail the API call if email fails - order update is complete
      }
    }

    return NextResponse.json({ order }, { status: 200 })
  } catch (error) {
    console.error("Order update error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
