import { NextResponse } from "next/server"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { sendOTPEmail } from "@/lib/email-service"
import { sendOtpWhatsApp } from "@/lib/whatsapp-service"

export const runtime = "nodejs"

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 })
    }

    await connectDB()

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() })

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return NextResponse.json(
        {
          success: true,
          message: "If an account exists with this email, an OTP has been sent to verify your identity.",
        },
        { status: 200 },
      )
    }

    // Generate OTP
    const otp = generateOTP()
    console.log(`[v0] Generated OTP for ${email}: ${otp}`)

    // Save OTP and expiration to database (10 minutes validity)
    user.otpCode = otp
    user.otpExpiry = new Date(Date.now() + 600000) // 10 minutes from now
    user.otpMethod = "email"
    await user.save()
    console.log(`[v0] OTP saved to database for ${email}`)

    // Send OTP via email
    console.log(`[v0] Sending OTP email to ${email}`)
    const emailSent = await sendOTPEmail(email, otp, user.fullname)
    await sendOtpWhatsApp(user.phone, otp, user.fullname)

    if (!emailSent) {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to send OTP. Please try again.",
        },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "If an account exists with this email, an OTP has been sent to verify your identity.",
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("[FORGOT_PASSWORD_ERROR]", error)
    return NextResponse.json({ success: false, message: "Something went wrong. Please try again." }, { status: 500 })
  }
}
