import mongoose from "mongoose"

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // Add index for faster queries
    },
    customerName: {
      type: String,
      required: true,
    },
    customerEmail: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
shippingAddress: {
      houseNumber: String,
      crossStreet: String,
      locality: String,
      landmark: String,
      fullAddress: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    billingAddress: {
      firstName: String,
      lastName: String,
      houseNumber: String,
      crossStreet: String,
      locality: String,
      landmark: String,
      fullAddress: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    gstDetails: {
      gstNumber: String,
      companyName: String,
    },
    items: [
      {
        productId: mongoose.Schema.Types.ObjectId,
        productName: String,
        productImage: String,
        productSlug: String,
        quantity: Number,
        price: Number,
        size: String,
        fabric: String,
        productColor: String,
        productColorHex: String,
      },
    ],
    subtotal: {
      type: Number,
      required: true,
    },
    shippingCost: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    couponCode: {
      type: String,
      default: null,
    },
    /** When an agent-assigned coupon was used, credits this agent for reporting. */
    couponAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "card", "upi", "cod"],
      default: "razorpay",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["pending", "order_received", "order_processing", "shipped", "in-transit", "delivered", "cancelled", "payment_failed"],
      default: "pending",
    },
    cancellationDetails: {
      cancelledAt: Date,
      cancelledBy: {
        type: String,
        enum: ["customer", "admin"],
      },
      reason: String,
    },
    refundDetails: {
      refundAmount: Number,
      refundStatus: {
        type: String,
        enum: ["pending", "initiated", "processed", "failed"],
        default: "pending",
      },
      refundDate: Date,
      refundTransactionId: String,
      refundReason: String,
      refundInitiatedAt: Date,
      refundProcessedAt: Date,
      bankNotificationReceived: {
        type: Boolean,
        default: false,
      },
    },
    orderTimeline: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        description: String,
      },
    ],
    trackingNumber: String,
    trackingUrl: {
      type: String,
      default: null,
    },
    shippingProvider: {
      type: String,
      default: null,
    },
    notes: String,
    paymentGateway: {
      type: String,
      enum: ["razorpay"],
      default: "razorpay",
    },
    razorpayOrderId: String,
    razorpayPaymentId: {
      type: String,
      sparse: true,
      unique: true,
    },
    razorpaySignature: String,
  },
  { timestamps: true },
)

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema)

export default Order
