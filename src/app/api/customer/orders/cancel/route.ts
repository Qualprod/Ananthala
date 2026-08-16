import { type NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import { jwtVerify } from "@/lib/jwt"
import connectDB from "@/lib/mongodb"
import Order from "@/models/order"
import { sendOrderCancellationEmail, sendAdminOrderCancellationNotification } from "@/lib/email-service"
import { sendOrderCancellationWhatsApp } from "@/lib/whatsapp-service"

export async function PUT(request: NextRequest) {
  try {
    // Get authentication token
    const token = request.cookies.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const decoded = jwtVerify(token)
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 })
    }

    // Get order ID from request body
    const body = await request.json().catch(() => ({}))
    const orderId = body.orderId
    const cancellationReason = body.reason || "Customer requested cancellation"

    if (!orderId) {
      return NextResponse.json({ success: false, error: "Order ID is required" }, { status: 400 })
    }

    await connectDB()

    // Convert userId string to MongoDB ObjectId
    let customerObjectId: mongoose.Types.ObjectId
    try {
      customerObjectId = new mongoose.Types.ObjectId(decoded.userId)
    } catch (e) {
      console.error("[v0] Invalid customer ID format:", decoded.userId)
      return NextResponse.json({ success: false, error: "Invalid user ID" }, { status: 400 })
    }

    // Find the order and verify it belongs to the customer
    const order = await Order.findOne({
      _id: new mongoose.Types.ObjectId(orderId),
      customerId: customerObjectId,
    })

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 })
    }

    // CRITICAL: Check if order can be cancelled
    // Cannot cancel if status is order_processing or beyond (shipped, in-transit, delivered)
    // Can only cancel if: pending or order_received
    const nonCancellableStatuses = ["order_processing", "shipped", "in-transit", "delivered", "cancelled"]
    
    if (nonCancellableStatuses.includes(order.orderStatus)) {
      return NextResponse.json(
        {
          success: false,
          canCancel: false,
          error: `Cannot cancel order. Order status is ${order.orderStatus.replace('_', ' ')}. Orders can only be cancelled before manufacturing starts.`,
        },
        { status: 400 },
      )
    }

    // Verify order is not already cancelled
    if (order.orderStatus === "cancelled") {
      return NextResponse.json(
        {
          success: false,
          error: "Order is already cancelled",
        },
        { status: 400 },
      )
    }

    // Update order status to cancelled
    const previousStatus = order.orderStatus
    order.orderStatus = "cancelled"

    // Record cancellation details
    order.cancellationDetails = {
      cancelledAt: new Date(),
      cancelledBy: "customer",
      reason: cancellationReason,
    }

    // Initialize refund details - refund will be processed by admin
    if (!order.refundDetails) {
      order.refundDetails = {}
    }
    order.refundDetails.refundAmount = order.totalAmount
    order.refundDetails.refundStatus = "pending"
    order.refundDetails.refundReason = `Order cancelled by customer. Previous status: ${previousStatus}`

    // Add timeline entry for cancellation
    order.orderTimeline.push({
      status: "cancelled",
      timestamp: new Date(),
      description: `Order cancelled by customer. Reason: ${cancellationReason}. Refund pending.`,
    })

    // Save the updated order
    await order.save()

    // Send cancellation confirmation email to customer
    try {
      console.log(`[v0] Sending cancellation email to customer for order ${order.orderId}`)
      
      const cancellationEmailData = {
        orderId: order.orderId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        items: order.items.map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          size: item.size,
          fabric: item.fabric,
          productColor: item.productColor,
        })),
        subtotal: order.subtotal,
        discount: order.discount || 0,
        shippingCost: order.shippingCost,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress || {},
        cancellationReason: cancellationReason,
      }
      
      const emailSent = await sendOrderCancellationEmail(cancellationEmailData)
      if (emailSent) {
        console.log(`[v0] Order cancellation confirmation email sent to ${order.customerEmail}`)
      }
      await sendOrderCancellationWhatsApp({
        phone: order.customerPhone,
        customerName: order.customerName,
        orderId: order.orderId,
        totalAmount: order.totalAmount,
      })
    } catch (emailError) {
      console.error(`[v0] Error sending cancellation email:`, emailError)
    }

    // Send admin notification about order cancellation
    try {
      console.log(`[v0] Sending admin notification for cancelled order ${order.orderId}`)
      
      const adminNotificationData = {
        orderId: order.orderId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        totalAmount: order.totalAmount,
        cancellationReason: cancellationReason,
        previousStatus: previousStatus,
        cancelledAt: new Date().toISOString(),
        refundAmount: order.totalAmount,
        itemsCount: order.items.length,
      }
      
      const adminNotified = await sendAdminOrderCancellationNotification(adminNotificationData)
      if (adminNotified) {
        console.log(`[v0] Admin notification sent for cancelled order ${order.orderId}`)
      }
    } catch (adminNotifyError) {
      console.error(`[v0] Error sending admin notification:`, adminNotifyError)
    }

    return NextResponse.json(
      {
        success: true,
        message: "Order cancelled successfully. Refund will be processed shortly.",
        order: {
          _id: order._id,
          orderId: order.orderId,
          orderStatus: order.orderStatus,
          refundDetails: order.refundDetails,
          updatedAt: order.updatedAt,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[v0] Cancel order API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to cancel order. Please try again.",
      },
      { status: 500 },
    )
  }
}
