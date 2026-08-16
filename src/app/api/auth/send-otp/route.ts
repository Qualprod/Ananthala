import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import nodemailer from "nodemailer"
import { sendMsg91OTP, normalizePhoneNumber } from "@/lib/msz91"
import { sendOtpWhatsApp } from "@/lib/whatsapp-service"

export const runtime = "nodejs"

// Helper function to generate 4-digit OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// Helper function to send email
async function sendOTPEmail(email: string, otp: string) {
  try {
    const emailProvider = process.env.EMAIL_PROVIDER || "gmail"

    let transporter

    if (emailProvider === "gmail") {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        throw new Error("Gmail credentials not configured. Please check your .env.local file.")
      }

      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD,
        },
      })
    } else if (emailProvider === "smtp") {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        throw new Error("SMTP credentials not configured. Please check your .env.local file.")
      }

      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number.parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      })
    } else {
      throw new Error(`Unsupported email provider: ${emailProvider}`)
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Ananthala Login",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #6D4530; text-align: center; margin-bottom: 20px;">Ananthala Login OTP</h2>
          <p style="font-size: 16px; color: #6D4530; margin-bottom: 10px;">Your one-time password is:</p>
          <div style="background-color: #F5F1ED; border: 2px solid #8B5A3C; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #8B5A3C; letter-spacing: 5px; margin: 0;">${otp}</h1>
          </div>
          <p style="font-size: 14px; color: #8B5A3C; margin-top: 20px;">This OTP will expire in 5 minutes.</p>
          <p style="font-size: 12px; color: #B8A396; margin-top: 20px; text-align: center;">If you didn't request this OTP, please ignore this email.</p>
        </div>
      `,
    }

    await transporter.sendMail(mailOptions)
    return true
  } catch (error) {
    console.error("[EMAIL_ERROR]", error)
    throw error
  }
}

// Send SMS OTP using MSG91 service
async function sendOTPSMS(phone: string, otp: string) {
  return sendMsg91OTP(phone, otp)
}

export async function POST(request: Request) {
  try {
    const { email, phone, method } = await request.json()

    // Validate input
    if (!method || !["email", "phone"].includes(method)) {
      return NextResponse.json({ success: false, message: "Invalid OTP method" }, { status: 400 })
    }

    if (method === "email" && !email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 })
    }

    if (method === "phone" && !phone) {
      return NextResponse.json({ success: false, message: "Phone number is required" }, { status: 400 })
    }

    // Connect to database
    await connectDB()

    // Generate OTP
    const otp = generateOTP()
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now

if (method === "email") {
      // Check if user exists with email - OTP login only for registered users
      const user = await User.findOne({ email: email.toLowerCase() })

      // If user doesn't exist, return error - they need to register first
      if (!user) {
        return NextResponse.json(
          { 
            success: false, 
            message: "No account found with this email. Please sign up first.",
            notRegistered: true 
          },
          { status: 404 },
        )
      }

      // Update existing user with OTP
      user.otpCode = otp
      user.otpExpiry = otpExpiry
      user.otpMethod = "email"

      try {
        // Send OTP via email
        await sendOTPEmail(email, otp)
        await user.save()

        return NextResponse.json(
          { success: true, message: "OTP sent to email", maskedEmail: email.replace(/(.{2})(.*)(@.*)/, "$1***$3") },
          { status: 200 },
        )
      } catch (emailError: any) {
        return NextResponse.json(
          {
            success: false,
            message:
              emailError.message || "Failed to send OTP email. Please verify your email configuration in .env.local",
          },
          { status: 500 },
        )
      }
    } else if (method === "phone") {
      try {
        // Normalize phone number (adds 91 if not present)
        const normalizedPhone = normalizePhoneNumber(phone)
        console.log(`[v0] Original phone: ${phone}, Normalized: ${normalizedPhone}`)

        // Check if user exists with phone - check both with and without country code
        const phoneCandidates = [normalizedPhone]
        if (normalizedPhone.startsWith("91")) {
          phoneCandidates.push(normalizedPhone.slice(2))
        }

        let user = await User.findOne({
          phone: { $in: phoneCandidates },
        })

        // If user doesn't exist, return error - they need to register first
        if (!user) {
          console.log(`[v0] No user found with phone: ${normalizedPhone}`)
          return NextResponse.json(
            { 
              success: false, 
              message: "No account found with this phone number. Please sign up first.",
              notRegistered: true 
            },
            { status: 404 },
          )
        }
        
        // Update phone to normalized format if it was stored without prefix
        if (user.phone !== normalizedPhone) {
          user.phone = normalizedPhone
        }

        console.log(`[v0] User found with phone: ${normalizedPhone}`)
        // Update existing user with OTP
        user.otpCode = otp
        user.otpExpiry = otpExpiry
        user.otpMethod = "phone"

        // Send OTP via SMS using MSG91
        console.log(`[v0] Attempting to send OTP via MSG91...`)
        await sendOTPSMS(normalizedPhone, otp)
        await sendOtpWhatsApp(normalizedPhone, otp, user.fullname)
        console.log(`[v0] SMS sent successfully`)

        // Save user with OTP
        await user.save()
        console.log(`[v0] User saved to database`)

        return NextResponse.json(
          { 
            success: true, 
            message: "OTP sent to phone", 
            maskedPhone: normalizedPhone.slice(-4).padStart(normalizedPhone.length, "*"),
            phone: normalizedPhone 
          },
          { status: 200 },
        )
      } catch (smsError: any) {
        console.error(`[v0] SMS Error:`, smsError)
        return NextResponse.json(
          {
            success: false,
            message:
              smsError.message || "Failed to send OTP SMS. Please verify your MSG91 configuration in .env.local",
          },
          { status: 500 },
        )
      }
    }
  } catch (error: any) {
    console.error("[SEND_OTP_ERROR]", error)
    return NextResponse.json(
      { success: false, message: error.message || "Something went wrong. Please try again." },
      { status: 500 },
    )
  }
}
