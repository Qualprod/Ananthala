import nodemailer from "nodemailer"
import type { Order, OrderItem } from "@/types/index"

const getEmailTransporter = async () => {
  // Check if using Gmail with EMAIL_PROVIDER explicitly set to gmail
  const emailProvider = process.env.EMAIL_PROVIDER || "gmail"
  const emailUser = process.env.EMAIL_USER
  // Check for both EMAIL_PASSWORD and EMAIL_APP_PASSWORD for backward compatibility
  const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_APP_PASSWORD

  console.log(`[Email Provider: ${emailProvider}`)
  console.log(`Email User: ${emailUser || "NOT SET"}`)
  console.log(`EMAIL_PASSWORD exists: ${!!process.env.EMAIL_PASSWORD}`)
  console.log(`EMAIL_APP_PASSWORD exists: ${!!process.env.EMAIL_APP_PASSWORD}`)
  console.log(`Final password exists: ${!!emailPassword}`)

  if (emailProvider === "gmail" && emailUser && emailPassword) {
    console.log(`Configuring Gmail transport for ${emailUser}`)
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    })
  }

  // Fallback to SMTP configuration
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  ) {
    console.log(`Configuring SMTP transport for ${process.env.SMTP_USER}`)
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }

  // Fallback to test account if no credentials provided
  console.warn("No email credentials configured. Using test account.")
  const testAccount = await nodemailer.createTestAccount()
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  })
}

export async function sendOrderConfirmationEmail(
  order: Partial<Order> & {
    customerEmail: string
    customerName: string
    orderId: string
    items: Array<{
      productName: string
      productImage?: string
      productSlug?: string
      quantity: number
      price: number
      size?: string
      fabric?: string
      productColor?: string
    }>
    subtotal: number
    discount: number
    shippingCost: number
    totalAmount: number
  },
): Promise<boolean> {
  try {
    const transporter = await getEmailTransporter()

    // Build items table HTML with product images and links
    const itemsHTML = order.items
      .map(
        (item: any) => `
      <tr>
        <td style="padding: 12px; vertical-align: top;">
          ${
            item.productImage
              ? `<img src="${item.productImage}" alt="${item.productName}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; display: block; margin-bottom: 8px;">`
              : ""
          }
        </td>
        <td style="padding: 12px; vertical-align: top;">
          ${
            item.productId || item.productSlug
              ? `<a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com/"}/product/${item.productId || item.productSlug}" style="color: #6d4530; text-decoration: none; font-weight: 600; font-size: 14px;">${item.productName}</a>`
              : `<div class="item-name">${item.productName}</div>`
          }
          ${
            item.size || item.fabric || item.productColor
              ? `<div class="item-specs" style="font-size: 12px; color: #8b5a3c; margin-top: 4px;">
              ${[item.size, item.fabric, item.productColor].filter(Boolean).join(" • ")}
            </div>`
              : ""
          }
        </td>
        <td style="text-align: center; padding: 12px; vertical-align: top;">${item.quantity}</td>
        <td style="text-align: right; padding: 12px; vertical-align: top;">₹${item.price.toFixed(2)}</td>
        <td style="text-align: right; padding: 12px; vertical-align: top; font-weight: 600;">₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `,
      )
      .join("")

    const trackOrderUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com/"}/track-order`

    // Build absolute URL properly
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com"
    const logoUrl = `${appUrl.replace(/\/$/, "")}/logo.png`

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation - Ananthala</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          line-height: 1.5;
          color: #4a4a4a;
          background-color: #f9f7f4;
          padding: 16px;
        }
        .wrapper {
          max-width: 600px;
          margin: 0 auto;
        }
        .container {
          background-color: #ffffff;
          border: 1px solid #e8ddd5;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        
        /* Header Section */
        .header {
          background: linear-gradient(135deg, #6d4530 0%, #8b5a3c 100%);
          color: white;
          padding: 32px 24px;
          text-align: center;
        }
        .header-logo {
          max-width: 160px;
          height: auto;
          margin: 0 auto 8px;
          display: block;
          border: none;
        }
        .header-subtitle {
          font-size: 13px;
          opacity: 0.9;
          letter-spacing: 0.3px;
        }
        
        /* Main Content */
        .content {
          padding: 32px 24px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #6d4530;
          margin-bottom: 6px;
        }
        .intro-text {
          color: #8b5a3c;
          font-size: 14px;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        
        /* Order Info Grid */
        .order-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 28px;
        }
        .order-card {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 1px solid #e8ddd5;
          border-radius: 8px;
          padding: 14px;
          text-align: center;
        }
        .order-card-label {
          color: #8b5a3c;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 6px;
        }
        .order-card-value {
          color: #6d4530;
          font-size: 14px;
          font-weight: 600;
          word-break: break-all;
        }
        
        /* Items Section */
        .items-header {
          font-size: 14px;
          font-weight: 700;
          color: #6d4530;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 13px;
        }
        .items-table thead tr {
          background: linear-gradient(135deg, #eed9c4 0%, #e6cbb9 100%);
          border: none;
        }
        .items-table th {
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          color: #6d4530;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        .items-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #ede9e3;
          color: #6d4530;
        }
        .items-table tr:last-child td {
          border-bottom: none;
        }
        .item-name {
          font-weight: 600;
          margin-bottom: 3px;
        }
        .item-specs {
          color: #8b5a3c;
          font-size: 11px;
          margin-top: 3px;
        }
        .text-right {
          text-align: right;
        }
        .font-medium {
          font-weight: 600;
        }
        
        /* Summary Section */
        .summary-box {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 1px solid #e8ddd5;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-size: 13px;
          color: #6d4530;
        }
        .summary-row.discount {
          color: #28a745;
          font-weight: 600;
        }
        .summary-row.total {
          border-top: 2px solid #d9cfc7;
          border-bottom: 2px solid #d9cfc7;
          padding: 12px 0;
          font-size: 15px;
          font-weight: 700;
          color: #6d4530;
        }
        .summary-label {
          color: #8b5a3c;
          font-weight: 500;
        }
        .summary-row.total .summary-label {
          color: #6d4530;
        }
        
        /* CTA Button */
        .button-container {
          text-align: center;
          margin: 24px 0;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #6d4530 0%, #5a3a26 100%);
          color: white;
          padding: 12px 32px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.2px;
          transition: all 0.3s ease;
          border: none;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(109, 69, 48, 0.2);
        }
        .cta-button:hover {
          background: linear-gradient(135deg, #5a3a26 0%, #4a2a1a 100%);
          box-shadow: 0 4px 8px rgba(109, 69, 48, 0.3);
        }
        
        /* Next Steps */
        .next-steps {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border-left: 4px solid #6d4530;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .next-steps-title {
          font-weight: 600;
          color: #6d4530;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 10px;
        }
        .next-steps-list {
          list-style: none;
          font-size: 13px;
          color: #8b5a3c;
          line-height: 1.8;
        }
        .next-steps-list li {
          margin-bottom: 6px;
          padding-left: 20px;
          position: relative;
        }
        .next-steps-list li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #6d4530;
          font-weight: bold;
        }
        
        /* Address Section */
        .address-box {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 1px solid #e8ddd5;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .address-title {
          font-weight: 600;
          color: #6d4530;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 10px;
        }
        .address-content {
          color: #8b5a3c;
          font-size: 13px;
          line-height: 1.8;
        }
        
        /* Footer */
        .footer {
          background-color: #f5f1ed;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #e8ddd5;
        }
        .footer-text {
          color: #8b5a3c;
          font-size: 12px;
          margin-bottom: 12px;
          line-height: 1.6;
        }
        .contact-info {
          font-size: 12px;
          color: #6d4530;
          margin-bottom: 16px;
          line-height: 1.6;
        }
        .contact-info strong {
          color: #6d4530;
          font-weight: 600;
        }
        .footer-links {
          margin: 16px 0;
        }
        .footer-link {
          color: #6d4530;
          text-decoration: none;
          font-size: 12px;
          margin: 0 10px;
          font-weight: 500;
          display: inline-block;
        }
        .footer-link:hover {
          text-decoration: underline;
        }
        .footer-bottom {
          color: #b0a595;
          font-size: 11px;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #e8ddd5;
        }
        
        /* Responsive */
        @media (max-width: 480px) {
          .order-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .items-table {
            font-size: 12px;
          }
          .items-table th,
          .items-table td {
            padding: 8px;
          }
          .header {
            padding: 24px 16px;
          }
          .content {
            padding: 20px 16px;
          }
          .footer {
            padding: 16px;
          }
          .greeting {
            font-size: 16px;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <!-- Header -->
          <div class="header">
            <img src="${logoUrl}" alt="Ananthala Logo" class="header-logo" />
            <div class="header-subtitle">Order Confirmation</div>
          </div>

          <!-- Content -->
          <div class="content">
            <p class="greeting">Hello ${order.customerName},</p>
            <p class="intro-text">Thank you for your order! We're excited to prepare and deliver your items. Your order has been received and is now being processed.</p>

            <!-- Order Info Grid -->
            <div class="order-grid">
              <div class="order-card">
                <div class="order-card-label">Order ID</div>
                <div class="order-card-value">${order.orderId}</div>
              </div>
              <div class="order-card">
                <div class="order-card-label">Order Date</div>
                <div class="order-card-value">${new Date().toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}</div>
              </div>
              <div class="order-card">
                <div class="order-card-label">Status</div>
                <div class="order-card-value" style="color: #4a9d6f;">Processing</div>
              </div>
            </div>

            <!-- Order Items -->
            <div class="items-header">Order Items</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 15%; text-align: center;">Image</th>
                  <th style="width: 35%;">Product</th>
                  <th style="width: 12%; text-align: center;">Qty</th>
                  <th style="width: 15%; text-align: right;">Price</th>
                  <th style="width: 23%; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <!-- Summary -->
            <div class="summary-box">
              <div class="summary-row">
                <span class="summary-label">Subtotal : </span>
                <span>₹${order.subtotal.toFixed(2)}</span>
              </div>
              ${
                order.discount > 0
                  ? `<div class="summary-row discount">
                <span class="summary-label">Discount : </span>
                <span>-₹${order.discount.toFixed(2)}</span>
              </div>`
                  : ""
              }
              <div class="summary-row">
                <span class="summary-label">Shipping : </span>
                <span>Free</span>
              </div>
              <div class="summary-row total">
                <span class="summary-label">Total Amount : </span>
                <span>₹${order.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <!-- CTA Button -->
            <div class="button-container">
              <a href="${trackOrderUrl}?orderId=${order.orderId}" class="cta-button">Track Your Order</a>
            </div>

            <!-- Shipping Address -->
            <div class="address-box">
              <div class="address-title">Delivery Address</div>
              <div class="address-content">
                <strong>${order.customerName}</strong><br>
                ${order.shippingAddress?.fullAddress || "Address not provided"}<br>
                ${[order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.zipCode].filter(Boolean).join(", ")}<br>
                ${order.shippingAddress?.country || ""}
              </div>
            </div>

            <!-- Next Steps -->
            <div class="next-steps">
              <div class="next-steps-title">What's Next?</div>
              <ul class="next-steps-list">
                <li>We'll confirm and process your order within 24 hours</li>
                <li>You'll receive a shipping notification with tracking details</li>
                <li>Track your order anytime using your Order ID above</li>
              </ul>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p class="footer-text">Need help? We're here for you!</p>
            <div class="contact-info">
              <strong>Email:</strong> qualprodsllp@gmail.com<br>
              <strong>Phone:</strong> +91 9071799966<br>
              <strong>Hours:</strong> Mon-Fri, 9 AM - 6 PM IST
            </div>
            <div class="footer-links">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com/"}/track-order" class="footer-link">Track Order</a>
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com/"}/contact-us" class="footer-link">Contact Us</a>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/policy-privacy" class="footer-link">Privacy Policy</a>
            </div>
            <div class="footer-bottom">
              © 2026 Ananthala. All rights reserved.<br>
              This is an automated email. Please do not reply directly.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@ananthala.com",
      to: order.customerEmail,
      subject: `Order Confirmation - ${order.orderId}`,
      html: htmlContent,
      text: `
Order Confirmation

Thank you for your order, ${order.customerName}!

Order ID: ${order.orderId}
Order Date: ${new Date().toLocaleDateString("en-IN")}
Status: Processing

Items:
${order.items.map((item: { productName: any; quantity: number; price: number }) => `- ${item.productName} x${item.quantity}: ₹${(item.price * item.quantity).toFixed(2)}`).join("\n")}

Subtotal :  ₹${order.subtotal.toFixed(2)}
${order.discount > 0 ? `Discount: -₹${order.discount.toFixed(2)}\n` : ""}Shipping : Free
Total: ₹${order.totalAmount.toFixed(2)}

Track your order here:
${trackOrderUrl}?orderId=${order.orderId}

If you have any questions, contact us at:
Email: qualprodsllp@gmail.com
Phone: +91 9071799966

Thank you for choosing Ananthala!
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Order confirmation email sent to ${order.customerEmail}`)
    return true
  } catch (error) {
    console.error(`Failed to send order confirmation email: ${error}`)
    return false
  }
}

interface OrderCancellationData {
  orderId: string
  customerName: string
  customerEmail: string
  items: Array<{
    productName: string
    quantity: number
    price: number
    size?: string
    fabric?: string
    productColor?: string
  }>
  subtotal: number
  discount: number
  shippingCost: number
  totalAmount: number
  shippingAddress?: {
    fullAddress?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
}

export async function sendOrderCancellationEmail(
  orderData: OrderCancellationData,
): Promise<boolean> {
  try {
    console.log(`Starting order cancellation email process for order : ${orderData.orderId}`)
    
    const transporter = await getEmailTransporter()
    
    if (!transporter) {
      console.error(`Email transporter not configured for cancellation email`)
      return false
    }

    // Build absolute URL properly
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com"
    const logoUrl = `${appUrl.replace(/\/$/, "")}/logo.png`

    const itemsHTML = orderData.items
      .map(
        (item) => `
      <tr>
        <td>
          <div class="item-name">${item.productName}</div>
          ${
            item.size || item.fabric || item.productColor
              ? `<div class="item-specs">
              ${[item.size, item.fabric, item.productColor].filter(Boolean).join(" • ")}
            </div>`
              : ""
          }
        </td>
        <td style="text-align: center;">${item.quantity}</td>
        <td class="text-right">₹${item.price.toFixed(2)}</td>
        <td class="text-right font-medium">₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `,
      )
      .join("")

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Cancellation - Ananthala</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          line-height: 1.5;
          color: #4a4a4a;
          background-color: #f9f7f4;
          padding: 16px;
        }
        .wrapper {
          max-width: 600px;
          margin: 0 auto;
        }
        .container {
          background-color: #ffffff;
          border: 1px solid #e8ddd5;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .header {
          background: linear-gradient(135deg, #d9534f 0%, #c9302c 100%);
          color: white;
          padding: 32px 24px;
          text-align: center;
        }
        .header-logo {
          max-width: 160px;
          height: auto;
          margin: 0 auto 8px;
          display: block;
        }
        .header-subtitle {
          font-size: 13px;
          opacity: 0.9;
          letter-spacing: 0.3px;
        }
        .content {
          padding: 32px 24px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #6d4530;
          margin-bottom: 6px;
        }
        .intro-text {
          color: #8b5a3c;
          font-size: 14px;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        .order-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 28px;
        }
        .order-card {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 1px solid #e8ddd5;
          border-radius: 8px;
          padding: 14px;
          text-align: center;
        }
        .order-card-label {
          color: #8b5a3c;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          margin-bottom: 6px;
        }
        .order-card-value {
          color: #6d4530;
          font-size: 14px;
          font-weight: 600;
          word-break: break-all;
        }
        .summary-box {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 1px solid #e8ddd5;
          border-radius: 8px;
          padding: 16px;
          margin: 24px 0;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-size: 13px;
          color: #6d4530;
        }
        .summary-label {
          color: #8b5a3c;
          font-weight: 500;
        }
        .summary-row.total {
          border-top: 2px solid #d9cfc7;
          border-bottom: 2px solid #d9cfc7;
          padding: 12px 0;
          font-size: 15px;
          font-weight: 700;
          color: #6d4530;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 13px;
        }
        .items-table thead tr {
          background: linear-gradient(135deg, #eed9c4 0%, #e6cbb9 100%);
        }
        .items-table th {
          padding: 10px 12px;
          text-align: left;
          font-weight: 600;
          color: #6d4530;
          font-size: 12px;
          text-transform: uppercase;
        }
        .items-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #ede9e3;
          color: #6d4530;
        }
        .item-name {
          font-weight: 600;
          margin-bottom: 3px;
        }
        .item-specs {
          color: #8b5a3c;
          font-size: 11px;
          margin-top: 3px;
        }
        .text-right {
          text-align: right;
        }
        .font-medium {
          font-weight: 600;
        }
        .notice-box {
          background-color: #ffe6e6;
          border-left: 4px solid #d9534f;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .notice-title {
          font-weight: 600;
          color: #c9302c;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 8px;
        }
        .notice-text {
          color: #8b5a3c;
          font-size: 13px;
          line-height: 1.6;
        }
        .footer {
          background-color: #f5f1ed;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #e8ddd5;
        }
        .footer-text {
          color: #8b5a3c;
          font-size: 12px;
          margin-bottom: 12px;
        }
        .contact-info {
          font-size: 12px;
          color: #6d4530;
          margin-bottom: 16px;
        }
        .footer-link {
          color: #6d4530;
          text-decoration: none;
          font-size: 12px;
          margin: 0 10px;
          font-weight: 500;
          display: inline-block;
        }
        @media (max-width: 480px) {
          .order-grid {
            grid-template-columns: 1fr;
          }
          .header {
            padding: 24px 16px;
          }
          .content {
            padding: 20px 16px;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="Ananthala Logo" class="header-logo" />
            <div class="header-subtitle">Password Reset Confirmation</div>
          </div>

          <div class="content">
            <p class="greeting">Hello ${orderData.customerName},</p>
            <p class="intro-text">Your order has been successfully cancelled. Below are the details of your cancelled order.</p>

            <div class="order-grid">
              <div class="order-card">
                <div class="order-card-label">Order ID</div>
                <div class="order-card-value">${orderData.orderId}</div>
              </div>
              <div class="order-card">
                <div class="order-card-label">Status</div>
                <div class="order-card-value" style="color: #d9534f;">Cancelled</div>
              </div>
            </div>

            <div class="notice-box">
              <div class="notice-title">Refund Information</div>
              <div class="notice-text">
                If payment was made, your refund will be processed back to your original payment method within 5-7 business days. Please check your bank account for the refund.
              </div>
            </div>

            <div style="font-size: 14px; font-weight: 700; color: #6d4530; margin-bottom: 12px; text-transform: uppercase;">Cancelled Items</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th style="width: 45%;">Product</th>
                  <th style="width: 15%; text-align: center;">Qty</th>
                  <th style="width: 20%; text-align: right;">Price</th>
                  <th style="width: 20%; text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <div class="summary-box">
              <div class="summary-row">
                <span class="summary-label">Subtotal</span>
                <span>₹${orderData.subtotal.toFixed(2)}</span>
              </div>
              ${
                orderData.discount > 0
                  ? `<div class="summary-row">
                <span class="summary-label">Discount</span>
                <span>₹${orderData.discount.toFixed(2)}</span>
              </div>`
                  : ""
              }
              <div class="summary-row">
                <span class="summary-label">Shipping</span>
                <span>Free</span>
              </div>
              <div class="summary-row total">
                <span class="summary-label">Total Amount</span>
                <span>₹${orderData.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div class="notice-box">
              <div class="notice-title">What Happens Next?</div>
              <div class="notice-text">
                • Your order status has been updated to "Cancelled"<br>
                • Refund will be processed within 5-7 business days<br>
                • You can contact us if you have any questions<br>
                • Feel free to place a new order anytime
              </div>
            </div>
          </div>

          <div class="footer">
            <p class="footer-text">Questions about your cancellation?</p>
            <div class="contact-info">
              <strong>Email:</strong> qualprodsllp@gmail.com<br>
              <strong>Phone:</strong> +91 9071799966
            </div>
            <div style="margin: 16px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com/"}/contact-us" class="footer-link">Contact Support</a>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/policy-privacy" class="footer-link">Privacy Policy</a>
            </div>
            <div style="color: #b0a595; font-size: 11px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e8ddd5;">
              © 2026 Ananthala. All rights reserved.<br>
              This is an automated email. Please do not reply directly.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@ananthala.com",
      to: orderData.customerEmail,
      subject: `Order Cancelled - ${orderData.orderId} | Ananthala`,
      html: htmlContent,
      text: `
Order Cancellation Confirmation

Hello ${orderData.customerName},

Your order has been successfully cancelled.

Order ID: ${orderData.orderId}
Status: Cancelled

Cancelled Items:
${orderData.items.map((item) => `- ${item.productName} x${item.quantity}: ₹${(item.price * item.quantity).toFixed(2)}`).join("\n")}

Subtotal :  ₹${orderData.subtotal.toFixed(2)}
${orderData.discount > 0 ? `Discount: ₹${orderData.discount.toFixed(2)}\n` : ""}Shipping : Free
Total Amount :  ₹${orderData.totalAmount.toFixed(2)}

REFUND INFORMATION:
Your refund will be processed back to your original payment method within 5-7 business days.

If you have any questions, please contact us at:
Email: qualprodsllp@gmail.com
Phone: +91 9071799966

We hope to see you again soon!
Thank you for choosing Ananthala.
      `,
    }

    console.log(`Sending cancellation email to ${orderData.customerEmail}`, {
      orderId: orderData.orderId,
      customerName: orderData.customerName,
      itemsCount: orderData.items.length,
    })
    
    const info = await transporter.sendMail(mailOptions)
    console.log(`Order cancellation email sent successfully to ${orderData.customerEmail}`, {
      messageId: info.messageId,
      orderId: orderData.orderId,
    })
    return true
  } catch (error) {
    console.error(`Failed to send order cancellation email:`, {
      error: error instanceof Error ? error.message : String(error),
      orderId: orderData.orderId,
      customerEmail: orderData.customerEmail,
    })
    return false
  }
}

interface OrderStatusUpdateData {
  orderId: string
  customerName: string
  customerEmail: string
  newStatus: string
  trackingNumber?: string
  notes?: string
  totalAmount: number
  items?: Array<{
    productId?: string
    productName: string
    productImage?: string
    productSlug?: string
    quantity: number
    price: number
    size?: string
    fabric?: string
    productColor?: string
  }>
}

export async function sendOrderStatusUpdateEmail(
  statusData: OrderStatusUpdateData,
): Promise<boolean> {
  try {
    const transporter = await getEmailTransporter()
    
    // Build absolute URL properly
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com"
    const logoUrl = `${appUrl.replace(/\/$/, "")}/logo.png`

    const getStatusColor = (status: string) => {
      const statusColors: Record<string, { color: string; bg: string; icon: string }> = {
        processing: { color: "#0066cc", bg: "#e6f2ff", icon: "⏳" },
        shipped: { color: "#ff9900", bg: "#fff4e6", icon: "📦" },
        "in-transit": { color: "#ff9900", bg: "#fff4e6", icon: "🚚" },
        delivered: { color: "#28a745", bg: "#e6ffe6", icon: "✓" },
        cancelled: { color: "#d9534f", bg: "#ffe6e6", icon: "✕" },
      }
      return statusColors[status] || { color: "#666", bg: "#f5f5f5", icon: "•" }
    }

    const statusInfo = getStatusColor(statusData.newStatus)
    const displayStatus =
      statusData.newStatus === "in-transit"
        ? "In Transit"
        : statusData.newStatus.charAt(0).toUpperCase() + statusData.newStatus.slice(1)

    const getStatusMessage = (status: string) => {
      const messages: Record<string, string> = {
        processing: "We are preparing your order and it will be shipped soon.",
        shipped: "Your order has been shipped! You can now track your package.",
        "in-transit": "Your order is on its way to you!",
        delivered: "Your order has been successfully delivered!",
        cancelled: "Your order has been cancelled. A refund will be processed shortly.",
      }
      return messages[status] || "Your order status has been updated."
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Status Update - Ananthala</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          line-height: 1.5;
          color: #4a4a4a;
          background-color: #f9f7f4;
          padding: 16px;
        }
        .wrapper {
          max-width: 600px;
          margin: 0 auto;
        }
        .container {
          background-color: #ffffff;
          border: 1px solid #e8ddd5;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .header {
          background: linear-gradient(135deg, #6d4530 0%, #8b5a3c 100%);
          color: white;
          padding: 32px 24px;
          text-align: center;
        }
        .header-logo {
          max-width: 160px;
          height: auto;
          margin: 0 auto 8px;
          display: block;
        }
        .content {
          padding: 32px 24px;
        }
        .status-box {
          background: ${statusInfo.bg};
          border: 2px solid ${statusInfo.color};
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          margin-bottom: 28px;
        }
        .status-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .status-title {
          font-size: 24px;
          font-weight: 700;
          color: ${statusInfo.color};
          margin-bottom: 8px;
        }
        .status-message {
          color: #6d4530;
          font-size: 14px;
          line-height: 1.6;
        }
        .order-info {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 1px solid #e8ddd5;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #ede9e3;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          color: #8b5a3c;
          font-weight: 600;
          font-size: 13px;
        }
        .info-value {
          color: #6d4530;
          font-weight: 600;
          text-align: right;
        }
        .tracking-section {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 1px solid #e8ddd5;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
        }
        .section-title {
          font-weight: 600;
          color: #6d4530;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 12px;
        }
        .tracking-number {
          font-family: monospace;
          font-size: 16px;
          font-weight: 700;
          color: #6d4530;
          word-break: break-all;
        }
        .button-container {
          text-align: center;
          margin: 24px 0;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #6d4530 0%, #5a3a26 100%);
          color: white;
          padding: 12px 32px;
          border-radius: 6px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(109, 69, 48, 0.2);
        }
        .cta-button:hover {
          background: linear-gradient(135deg, #5a3a26 0%, #4a2a1a 100%);
          box-shadow: 0 4px 8px rgba(109, 69, 48, 0.3);
        }
        .notes-section {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 1px solid #e8ddd5;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
          font-size: 13px;
          line-height: 1.6;
          color: #8b5a3c;
        }
        .footer {
          background-color: #f5f1ed;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #e8ddd5;
        }
        .footer-text {
          color: #8b5a3c;
          font-size: 12px;
          margin-bottom: 12px;
        }
        .contact-info {
          font-size: 12px;
          color: #6d4530;
          margin-bottom: 16px;
        }
        @media (max-width: 480px) {
          .header {
            padding: 24px 16px;
          }
          .content {
            padding: 20px 16px;
          }
          .status-box {
            padding: 16px;
          }
          .status-icon {
            font-size: 36px;
          }
          .status-title {
            font-size: 18px;
          }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="Ananthala Logo" class="header-logo" />
            <div class="header-subtitle">Order Status Update</div>
          </div>

          <div class="content">
            <p style="font-size: 16px; font-weight: 600; color: #6d4530; margin-bottom: 12px;">Hi ${statusData.customerName},</p>
            <p style="color: #8b5a3c; font-size: 14px; margin-bottom: 24px; line-height: 1.6;">Your order status has been updated. See the details below : </p>

            <div class="status-box">
              <div class="status-icon">${statusInfo.icon}</div>
              <div class="status-title">${displayStatus}</div>
              <div class="status-message">${getStatusMessage(statusData.newStatus)}</div>
            </div>

            <div class="order-info">
              <div class="info-row">
                <span class="info-label">Order ID :  </span>
                <span class="info-value" style="font-family: monospace;">${statusData.orderId}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Current Status :  </span>
                <span class="info-value">${displayStatus}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Order Total</span>
                <span class="info-value">₹${statusData.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            ${
              statusData.trackingNumber
                ? `
            <div class="tracking-section">
              <div class="section-title">Tracking Number</div>
              <div class="tracking-number">${statusData.trackingNumber}</div>
              <p style="color: #8b5a3c; font-size: 12px; margin-top: 8px;">Use this number to track your package with the courier.</p>
            </div>
            `
                : ""
            }

            ${
              statusData.notes
                ? `
            <div class="notes-section">
              <strong style="color: #6d4530;">Additional Information : </strong><br>
              ${statusData.notes}
            </div>
            `
                : ""
            }

            <div class="button-container">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com/"}/customer/orders?orderId=${statusData.orderId}" class="cta-button">View Order Details</a>
            </div>
          </div>

          <div class="footer">
            <p class="footer-text">Need help? We're here for you!</p>
            <div class="contact-info">
              <strong>Email:</strong> qualprodsllp@gmail.com<br>
              <strong>Phone:</strong> +91 9071799966
            </div>
            <div style="color: #b0a595; font-size: 11px; margin-top: 16px; padding-top: 12px; border-top: 1px solid #e8ddd5;">
              © 2026 Ananthala. All rights reserved.<br>
              This is an automated email. Please do not reply directly.
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@ananthala.com",
      to: statusData.customerEmail,
      subject: `Order Status Update: ${displayStatus} - ${statusData.orderId} | Ananthala`,
      html: htmlContent,
      text: `
Order Status Update

Hello ${statusData.customerName},

Your order status has been updated to: ${displayStatus}

Order ID: ${statusData.orderId}
New Status: ${displayStatus}
Order Total : ₹${statusData.totalAmount.toFixed(2)}

${statusData.trackingNumber ? `Tracking Number: ${statusData.trackingNumber}\n` : ""}
${statusData.notes ? `Additional Information: ${statusData.notes}\n` : ""}

Message: ${getStatusMessage(statusData.newStatus)}

View your order details: ${process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com/"}/customer/orders?orderId=${statusData.orderId}

If you have any questions, please contact us at:
Email: qualprodsllp@gmail.com
Phone: +91 9071799966

Thank you for choosing Ananthala!
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Order status update email sent to ${statusData.customerEmail}`)
    return true
  } catch (error) {
    console.error(`Failed to send order status update email: ${error}`)
    return false
  }
}

// Send welcome email to new user
export async function sendWelcomeEmail(
  email: string,
  fullname: string
): Promise<boolean> {
  try {
    const transporter = await getEmailTransporter()
    
    if (!transporter) {
      console.error(`Email transporter not configured for welcome email`)
      return false
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com"
    const logoUrl = `${appUrl.replace(/\/$/, "")}/logo.png`

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Ananthala</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F5F1ED;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #6d4530 0%, #8b5a3c 100%); padding: 40px 32px; text-align: center;">
            <img src="${logoUrl}" alt="Ananthala Logo" style="max-width: 160px; height: auto; margin-bottom: 16px;" />
            <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0; letter-spacing: 1px;">Premium Comfort for Your Little Ones</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 32px;">
            <h2 style="color: #6D4530; font-size: 24px; margin: 0 0 16px 0;">Welcome, ${fullname}!</h2>
            
            <p style="color: #8B5A3C; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
              Thank you for joining the Ananthala family! Your account has been successfully created and verified.
            </p>
            
            <div style="background-color: #F5F1ED; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
              <h3 style="color: #6D4530; font-size: 16px; margin: 0 0 16px 0;">What You Can Do Now:</h3>
              <ul style="color: #8B5A3C; font-size: 14px; line-height: 2; margin: 0; padding-left: 20px;">
                <li>Browse our premium collection of baby products</li>
                <li>Customize products with your preferred colors and sizes</li>
                <li>Track your orders in real-time</li>
                <li>Save items to your wishlist</li>
                <li>Enjoy exclusive member discounts</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${appUrl}" style="display: inline-block; background: linear-gradient(135deg, #6d4530 0%, #5a3a26 100%); color: white; padding: 14px 40px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; letter-spacing: 0.5px;">
                Start Shopping
              </a>
            </div>
            
            <div style="border-top: 1px solid #E5D5C5; padding-top: 24px; margin-top: 32px;">
              <p style="color: #8B5A3C; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
                At Ananthala, we are committed to providing the finest quality products for your precious little ones. Each product is crafted with love and care to ensure maximum comfort and safety.
              </p>
              <p style="color: #6D4530; font-size: 14px; font-weight: 600; margin: 0;">
                Welcome to the family!
              </p>
              <p style="color: #8B5A3C; font-size: 14px; margin: 4px 0 0 0;">
                The Ananthala Team
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #F5F1ED; padding: 24px 32px; text-align: center; border-top: 1px solid #E5D5C5;">
            <p style="color: #8B5A3C; font-size: 13px; margin: 0 0 12px 0;">
              Need help? We are here for you!
            </p>
            <p style="color: #6D4530; font-size: 13px; margin: 0 0 8px 0;">
              <strong>Email:</strong> qualprodsllp@gmail.com | <strong>Phone:</strong> +91 9071799966
            </p>
            <div style="margin-top: 16px;">
              <a href="${appUrl}/contact-us" style="color: #6D4530; text-decoration: none; font-size: 12px; margin: 0 10px;">Contact Us</a>
              <a href="${appUrl}/policy-privacy" style="color: #6D4530; text-decoration: none; font-size: 12px; margin: 0 10px;">Privacy Policy</a>
              <a href="${appUrl}/policy-terms" style="color: #6D4530; text-decoration: none; font-size: 12px; margin: 0 10px;">Terms of Service</a>
            </div>
            <p style="color: #B8A396; font-size: 11px; margin-top: 16px;">
              © 2026 Ananthala. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@ananthala.com",
      to: email,
      subject: "Welcome to Ananthala - Your Account is Ready!",
      html: htmlContent,
      text: `
Welcome to Ananthala, ${fullname}!

Thank you for joining the Ananthala family! Your account has been successfully created and verified.

What You Can Do Now:
- Browse our premium collection of baby products
- Customize products with your preferred colors and sizes
- Track your orders in real-time
- Save items to your wishlist
- Enjoy exclusive member discounts

Visit us at: ${appUrl}

At Ananthala, we are committed to providing the finest quality products for your precious little ones.

Welcome to the family!
The Ananthala Team

Need help?
Email: qualprodsllp@gmail.com
Phone: +91 9071799966

© 2026 Ananthala. All rights reserved.
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Welcome email sent to ${email}`)
    return true
  } catch (error) {
    console.error(`Failed to send welcome email: ${error}`)
    return false
  }
}

export async function sendOTPEmail(
  email: string,
  otp: string,
  userName: string,
): Promise<boolean> {
  try {
    console.log(`Starting sendOTPEmail for ${email}`)
    const transporter = await getEmailTransporter()

    if (!transporter) {
      console.error(`Email transporter not configured for OTP email`)
      return false
    }

    console.log(`Email transporter configured successfully`)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com"
    const logoUrl = `${appUrl.replace(/\/$/, "")}/logo.png`

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset OTP - Ananthala</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.5;
          color: #4a4a4a;
          background-color: #f9f7f4;
          padding: 16px;
        }
        .wrapper {
          max-width: 600px;
          margin: 0 auto;
        }
        .container {
          background-color: #ffffff;
          border: 1px solid #e8ddd5;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .header {
          background: linear-gradient(135deg, #6d4530 0%, #8b5a3c 100%);
          color: white;
          padding: 32px 24px;
          text-align: center;
        }
        .header-logo {
          max-width: 160px;
          height: auto;
          margin: 0 auto 8px;
          display: block;
        }
        .content {
          padding: 32px 24px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #6d4530;
          margin-bottom: 6px;
        }
        .intro-text {
          color: #8b5a3c;
          font-size: 14px;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        .otp-box {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 2px solid #8b5a3c;
          border-radius: 8px;
          padding: 24px;
          text-align: center;
          margin: 24px 0;
        }
        .otp-label {
          color: #8b5a3c;
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.3px;
          margin-bottom: 12px;
        }
        .otp-value {
          font-size: 36px;
          font-weight: 700;
          color: #6d4530;
          letter-spacing: 8px;
          font-family: 'Courier New', monospace;
        }
        .expiry-note {
          color: #b8a396;
          font-size: 12px;
          margin-top: 12px;
          font-style: italic;
        }
        .warning-box {
          background-color: #fef3cd;
          border: 1px solid #ffc107;
          border-radius: 6px;
          padding: 12px;
          margin: 20px 0;
          color: #856404;
          font-size: 13px;
        }
        .footer {
          background-color: #f5f1ed;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #e8ddd5;
        }
        .footer-text {
          color: #8b5a3c;
          font-size: 12px;
          margin-bottom: 12px;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="Ananthala Logo" class="header-logo" />
          </div>
          <div class="content">
            <p class="greeting">Hello ${userName},</p>
            <p class="intro-text">We received a request to reset your password. Use the 4-digit verification code below to verify your identity and proceed with resetting your password.</p>
            
            <div class="otp-box">
              <div class="otp-label">Your Verification Code</div>
              <div class="otp-value">${otp}</div>
              <div class="expiry-note">This code will expire in 10 minutes</div>
            </div>

            <div class="warning-box">
              <strong>Important:</strong> Never share this code with anyone. Ananthala staff will never ask for your verification code.
            </div>

            <p class="intro-text">Once you enter this code, you'll be able to set a new password for your account.</p>
          </div>
          <div class="footer">
            <p class="footer-text">If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
            <p class="footer-text">Need help? Contact us at qualprodsllp@gmail.com</p>
            <p class="footer-text">© 2026 Ananthala. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@ananthala.com",
      to: email,
      subject: "Password Reset Verification Code - Ananthala",
      html: htmlContent,
      text: `
Hello ${userName},

We received a request to reset your password. Use this 4-digit verification code:

${otp}

This code will expire in 10 minutes.

If you didn't request this password reset, please ignore this email.

Thank you,
Ananthala Team
      `,
    }

    console.log(`Calling transporter.sendMail with options:`, {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    })
    const result = await transporter.sendMail(mailOptions)
    console.log(`Password reset OTP sent successfully to ${email}`, result)
    return true
  } catch (error) {
    console.error(`Failed to send OTP email:`, error)
    return false
  }
}

export async function sendPasswordResetConfirmationEmail(
  email: string,
  userName: string,
): Promise<boolean> {
  try {
    const transporter = await getEmailTransporter()

    if (!transporter) {
      console.error(`Email transporter not configured for password reset email`)
      return false
    }

    // Build absolute URL properly
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com"
    const logoUrl = `${appUrl.replace(/\/$/, "")}/logo.png`

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Confirmation - Ananthala</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.5;
          color: #4a4a4a;
          background-color: #f9f7f4;
          padding: 16px;
        }
        .wrapper {
          max-width: 600px;
          margin: 0 auto;
        }
        .container {
          background-color: #ffffff;
          border: 1px solid #e8ddd5;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        .header {
          background: linear-gradient(135deg, #6d4530 0%, #8b5a3c 100%);
          color: white;
          padding: 32px 24px;
          text-align: center;
        }
        .header-logo {
          max-width: 160px;
          height: auto;
          margin: 0 auto 8px;
          display: block;
        }
        .header-subtitle {
          font-size: 13px;
          opacity: 0.9;
          letter-spacing: 0.3px;
        }
        .content {
          padding: 32px 24px;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          color: #6d4530;
          margin-bottom: 6px;
        }
        .intro-text {
          color: #8b5a3c;
          font-size: 14px;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        .success-box {
          background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
          border: 1px solid #28a745;
          border-radius: 8px;
          padding: 20px;
          margin: 24px 0;
          text-align: center;
        }
        .success-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }
        .success-title {
          color: #155724;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .success-message {
          color: #1e7e34;
          font-size: 14px;
        }
        .security-section {
          background: linear-gradient(135deg, #fafaf8 0%, #f5f1ed 100%);
          border: 1px solid #e8ddd5;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .security-title {
          color: #6d4530;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 12px;
        }
        .security-list {
          list-style: none;
          font-size: 13px;
          color: #8b5a3c;
          line-height: 1.8;
        }
        .security-list li {
          margin-bottom: 8px;
          padding-left: 20px;
          position: relative;
        }
        .security-list li:before {
          content: "✓";
          position: absolute;
          left: 0;
          color: #6d4530;
          font-weight: bold;
        }
        .warning-section {
          background-color: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
        }
        .warning-title {
          color: #856404;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .warning-text {
          color: #856404;
          font-size: 13px;
          line-height: 1.6;
        }
        .footer {
          background-color: #f5f1ed;
          padding: 24px;
          text-align: center;
          border-top: 1px solid #e8ddd5;
        }
        .footer-text {
          color: #8b5a3c;
          font-size: 12px;
          margin-bottom: 12px;
          line-height: 1.6;
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <img src="${logoUrl}" alt="Ananthala Logo" class="header-logo" />
            <div class="header-subtitle">Order Confirmation</div>
          </div>
          <div class="content">
            <p class="greeting">Hello ${userName},</p>
            
            <div class="success-box">
              <div class="success-icon">✓</div>
              <div class="success-title">Password Successfully Reset</div>
              <div class="success-message">Your account password has been reset successfully.</div>
            </div>

            <p class="intro-text">Your Ananthala account password has been changed. If you didn't make this change, please take immediate action to secure your account.</p>

            <div class="security-section">
              <div class="security-title">What Happens Next</div>
              <ul class="security-list">
                <li>You can now log in with your new password</li>
                <li>Your old password will no longer work</li>
                <li>All active sessions have been cleared for security</li>
                <li>You may need to log in again on your devices</li>
              </ul>
            </div>

            <div class="warning-section">
              <div class="warning-title">⚠️ Security Alert</div>
              <div class="warning-text">
                If you did not request this password change, please contact us immediately at qualprodsllp@gmail.com. You can also change your password again if you believe your account has been compromised.
              </div>
            </div>

            <p class="intro-text">Thank you for keeping your Ananthala account secure!</p>
          </div>
          <div class="footer">
            <p class="footer-text">Need help? Contact us immediately if you did not request this password reset.</p>
            <p class="footer-text">
              <strong>Email:</strong> qualprodsllp@gmail.com<br>
              <strong>Phone:</strong> +91 9071799966
            </p>
            <p class="footer-text">© 2026 Ananthala. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
    `

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@ananthala.com",
      to: email,
      subject: "Your Account Password Has Been Reset - Ananthala",
      html: htmlContent,
      text: `
Hello ${userName},

Your Ananthala account password has been reset successfully.

WHAT HAPPENS NEXT:
- You can now log in with your new password
- Your old password will no longer work
- All active sessions have been cleared for security
- You may need to log in again on your devices

SECURITY ALERT:
If you did not request this password change, please contact us immediately at qualprodsllp@gmail.com.

Thank you for keeping your Ananthala account secure!

Need help?
Email: qualprodsllp@gmail.com
Phone: +91 9071799966

© 2026 Ananthala. All rights reserved.
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Password reset confirmation email sent to ${email}`)
    return true
  } catch (error) {
    console.error(`Failed to send password reset confirmation email: ${error}`)
    return false
  }
}

export async function sendAdminOrderCancellationNotification(
  notificationData: {
    orderId: string
    customerName: string
    customerEmail: string
    customerPhone: string
    totalAmount: number
    cancellationReason: string
    previousStatus: string
    cancelledAt: string
    refundAmount: number
    itemsCount: number
  },
): Promise<boolean> {
  try {
    const transporter = await getEmailTransporter()

    if (!transporter) {
      console.error(`Email transporter not configured for admin notification`)
      return false
    }

    // Build absolute URL properly
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com"
    const logoUrl = `${appUrl.replace(/\/$/, "")}/logo.png`

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8B5A3C 0%, #6D4530 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .header-logo { max-width: 160px; height: auto; margin: 0 auto 8px; display: block; }
        .header-subtitle { font-size: 13px; opacity: 0.9; letter-spacing: 0.3px; }
        .content { background: #f9f7f4; padding: 20px; border: 1px solid #E5DDD0; }
        .alert { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .alert-title { color: #dc2626; font-weight: bold; margin-bottom: 8px; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: bold; color: #6D4530; margin-bottom: 12px; border-bottom: 2px solid #D9CFC7; padding-bottom: 8px; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5DDD0; }
        .info-label { font-weight: bold; color: #6D4530; }
        .info-value { color: #555; }
        .footer { background: #f5f1ed; padding: 15px; border-top: 1px solid #E5DDD0; font-size: 12px; text-align: center; color: #666; }
        .action-button { display: inline-block; background: #6D4530; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="${logoUrl}" alt="Ananthala Logo" class="header-logo" />
          <div class="header-subtitle">Order Cancellation Alert</div>
        </div>
        
        <div class="content">
          <div class="alert">
            <div class="alert-title">⚠️ Order Cancelled by Customer</div>
            An order has been cancelled by the customer and requires refund processing.
          </div>

          <div class="section">
            <div class="section-title">Order Details </div>
            <div class="info-row">
              <span class="info-label">Order ID : </span>
              <span class="info-value"><strong>${notificationData.orderId}</strong></span>
            </div>
            <div class="info-row">
              <span class="info-label">Cancelled At : </span>
              <span class="info-value">${new Date(notificationData.cancelledAt).toLocaleString('en-IN')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Previous Status : </span>
              <span class="info-value">${notificationData.previousStatus.replace('_', ' ')}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Customer Information</div>
            <div class="info-row">
              <span class="info-label">Name : </span>
              <span class="info-value">${notificationData.customerName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Email : </span>
              <span class="info-value">${notificationData.customerEmail}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Phone : </span>
              <span class="info-value">${notificationData.customerPhone}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Refund Information</div>
            <div class="info-row">
              <span class="info-label">Refund Amount : </span>
              <span class="info-value"><strong>₹${notificationData.refundAmount.toFixed(2)}</strong></span>
            </div>
            <div class="info-row">
              <span class="info-label">Items Cancelled : </span>
              <span class="info-value">${notificationData.itemsCount}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Refund Status : </span>
              <span class="info-value" style="color: #dc2626; font-weight: bold;">PENDING - Requires Processing</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Cancellation Reason</div>
            <p style="background: white; padding: 12px; border-left: 3px solid #D9CFC7; margin: 0; color: #555;">
              ${notificationData.cancellationReason}
            </p>
          </div>

          <div class="section" style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #E5DDD0;">
            <strong>NEXT STEPS:</strong>
            <ul style="margin: 10px 0 0 20px; padding: 0;">
              <li>Log in to Ananthala Admin Dashboard</li>
              <li>Navigate to Order Management</li>
              <li>Find Order ID :  ${notificationData.orderId}</li>
              <li>Process refund and update refund status</li>
              <li>Confirm receipt of bank notification once refund is processed</li>
            </ul>
          </div>

          <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.ananthala.com/"}/admin/orders" class="action-button" style="text-align: center; display: block; width: 200px; margin: 20px auto;">View Order in Admin</a>
        </div>

        <div class="footer">
          <p>This is an automated notification. Please do not reply to this email.</p>
          <p>© 2026 Ananthala. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `

    const adminEmail = process.env.ADMIN_EMAIL || "qualprodsllp@gmail.com"

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@ananthala.com",
      to: adminEmail,
      subject: `[ACTION REQUIRED] Order Cancellation - ${notificationData.orderId} - Refund Pending`,
      html: htmlContent,
      text: `
ORDER CANCELLATION ALERT

Order ID: ${notificationData.orderId}
Customer: ${notificationData.customerName}
Email: ${notificationData.customerEmail}
Phone: ${notificationData.customerPhone}

CANCELLATION DETAILS:
- Cancelled At: ${new Date(notificationData.cancelledAt).toLocaleString('en-IN')}
- Previous Status: ${notificationData.previousStatus}
- Reason: ${notificationData.cancellationReason}

REFUND REQUIRED:
- Refund Amount: ₹${notificationData.refundAmount.toFixed(2)}
- Items Cancelled: ${notificationData.itemsCount}
- Status: PENDING - Requires Processing

ACTION REQUIRED:
1. Log in to Admin Dashboard
2. Navigate to Order Management
3. Find Order : ${notificationData.orderId}
4. Process refund to customer
5. Update refund status with transaction ID
6. Mark bank notification received when processed

© 2026 Ananthala. All rights reserved.
      `,
    }

    await transporter.sendMail(mailOptions)
    console.log(`Admin cancellation notification sent for order ${notificationData.orderId}`)
    return true
  } catch (error) {
    console.error(`Failed to send admin cancellation notification: ${error}`)
    return false
  }
}
