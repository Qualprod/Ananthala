/**
 * MSG91 OTP Service Utility
 * Handles all MSG91 SMS/OTP operations
 */

interface MSG91Response {
  type: "success" | "error"
  message: string
  request_id?: string
}

/**
 * Validates MSG91 configuration
 */
export function validateMsg91Config(): void {
  const authKey = process.env.MSG91_AUTH_KEY
  const senderId = process.env.MSG91_SENDER_ID
  const templateId = process.env.MSG91_DLT_TEMPLATE_ID

  if (!authKey || !senderId) {
    throw new Error(
      "MSG91 credentials not configured. Please add MSG91_AUTH_KEY and MSG91_SENDER_ID to your .env.local file.",
    )
  }

  if (!templateId) {
    throw new Error(
      "MSG91 DLT Template ID not configured. Please add MSG91_DLT_TEMPLATE_ID to your .env.local file. Get this from MSG91 → DLT Registration → OTP Template ID.",
    )
  }
}

/**
 * Normalizes and validates phone number
 * Converts to format with country code (91 for India)
 */
export function normalizePhoneNumber(phone: string): string {
  const value = phone.trim()
  const digits = value.replace(/\D/g, "")

  if (digits.length < 6 || digits.length > 15) {
    throw new Error("Invalid phone number. Please provide a valid number with country code.")
  }

  if (value.startsWith("+")) {
    return digits
  }

  if (digits.startsWith("00")) {
    return digits.slice(2)
  }

  // Backward compatibility: local 10-digit numbers default to India.
  if (digits.length === 10) {
    return "91" + digits
  }

  return digits
}

/**
 * Sends SMS via MSG91 API (handles both OTP and generic SMS)
 */
async function sendViaMSG91(phone: string, message: string): Promise<boolean> {
  try {
    validateMsg91Config()

    const normalizedPhone = normalizePhoneNumber(phone)
    const authKey = process.env.MSG91_AUTH_KEY!
    const senderId = process.env.MSG91_SENDER_ID!
    const templateId = process.env.MSG91_DLT_TEMPLATE_ID!

    console.log(` === SENDING SMS VIA MSG91 ===`)
    console.log(` Phone: ${normalizedPhone}`)
    console.log(` SenderID: ${senderId}`)
    console.log(` AuthKey (first 10 chars): ${authKey.substring(0, 10)}...`)

    // Build exact MSG91 API URL format: authkey=XXX&sender=YYY&mobiles=91XXXXXXXXXX&route=4&DLT_TE_ID=ZZZ&message=MSG
    const url = `https://api.msg91.com/api/sendhttp.php?authkey=${authKey}&sender=${senderId}&mobiles=${normalizedPhone}&route=4&DLT_TE_ID=${templateId}&message=${encodeURIComponent(message)}`

    console.log(` Full URL (with authkey hidden): https://api.msg91.com/api/sendhttp.php?authkey=***&sender=${senderId}&mobiles=${normalizedPhone}&route=4&DLT_TE_ID=${templateId}&message=...`)

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    const responseText = await response.text()
    const trimmedResponse = responseText.trim()

    console.log(` MSG91 Response Status: ${response.status}`)
    console.log(` MSG91 Response Body: "${trimmedResponse}"`)

    // Check for numeric success codes (401 or 0 = Success)
    if (trimmedResponse === "401" || trimmedResponse === "0") {
      console.log(`[SMS_SUCCESS] Message sent successfully to ${normalizedPhone}`)
      return true
    }

    // Check if response is a message ID (hex string)
    if (/^[0-9a-fA-F]{15,}$/.test(trimmedResponse)) {
      console.log(`[SMS_SUCCESS] Message sent successfully to ${normalizedPhone} (Message ID: ${trimmedResponse})`)
      return true
    }

    // Check for success keywords
    if (trimmedResponse.toLowerCase().includes("success")) {
      console.log(`[SMS_SUCCESS] Message sent successfully to ${normalizedPhone}`)
      return true
    }

    // If status is 200 and no error indicators, assume success
    if (response.status === 200 && !trimmedResponse.toLowerCase().includes("error") && !trimmedResponse.toLowerCase().includes("invalid")) {
      console.log(`[SMS_SUCCESS] Message sent successfully to ${normalizedPhone}`)
      return true
    }

    // Error detection
    if (trimmedResponse.toLowerCase().includes("authentication failed") || trimmedResponse.includes("-1")) {
      throw new Error(`MSG91 Authentication Error: Invalid AuthKey`)
    }

    if (trimmedResponse.toLowerCase().includes("invalid mobile")) {
      throw new Error(`MSG91 Error: Invalid phone number format`)
    }

    if (trimmedResponse.toLowerCase().includes("insufficient") || trimmedResponse.toLowerCase().includes("balance")) {
      throw new Error(`MSG91 Error: Insufficient balance in MSG91 account`)
    }

    if (trimmedResponse.toLowerCase().includes("invalid sender")) {
      throw new Error(`MSG91 Error: Sender ID "${senderId}" is not valid`)
    }

    if (trimmedResponse.toLowerCase().includes("invalid") && trimmedResponse.toLowerCase().includes("template")) {
      throw new Error(`MSG91 Error: Template ID "${templateId}" is invalid`)
    }

    if (!response.ok) {
      throw new Error(`MSG91 API Error. Status: ${response.status}`)
    }

    // Unclear response with 200 status - assume success
    console.warn(`Unclear response but status 200: ${trimmedResponse}`)
    return true
  } catch (error) {
    console.error("[SMS_ERROR]", error)
    throw error
  }
}

/**
 * Sends OTP via MSG91 API
 */
export async function sendMsg91OTP(phone: string, otp: string): Promise<boolean> {
  const message = `Your OTP for verification is ${otp}. Please do not share this OTP with anyone - Ananthala.`
  console.log(`OTP: ${otp}`)
  return sendViaMSG91(phone, message)
}

/**
 * Sends generic SMS via MSG91 API
 */
export async function sendMsg91SMS(phone: string, message: string): Promise<boolean> {
  return sendViaMSG91(phone, message)
}
