import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import connectDB from "@/lib/mongodb"
import User from "@/models/User"
import { validatePassword } from "@/lib/password-validation"
import { sendPasswordResetConfirmationEmail } from "@/lib/email-service"
import { sendPasswordResetConfirmationWhatsApp } from "@/lib/whatsapp-service"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const { email, newPassword } = await request.json()

    if (!email || !newPassword) {
      return NextResponse.json({ success: false, message: "Email and new password are required" }, { status: 400 })
    }

    // Validate new password against requirements
    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Password does not meet requirements.",
          errors: passwordValidation.errors,
        },
        { status: 400 },
      )
    }

    await connectDB()

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 })
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    user.password = hashedPassword
    await user.save()

    // Send password reset confirmation email
    await sendPasswordResetConfirmationEmail(email, user.fullname)
    await sendPasswordResetConfirmationWhatsApp(user.phone, user.fullname)

    return NextResponse.json(
      {
        success: true,
        message: "Password has been reset successfully. You can now login with your new password.",
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error("[RESET_PASSWORD_ERROR]", error)
    return NextResponse.json({ success: false, message: "Something went wrong. Please try again." }, { status: 500 })
  }
}
