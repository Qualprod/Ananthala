import "server-only"

const DEFAULT_API_VERSION = "v23.0"
const REQUEST_TIMEOUT_MS = 8000

type TemplateParameter = string | number

type WhatsAppTemplate = {
  name: string
  language?: string
  parameters?: TemplateParameter[]
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, "")
  if (!digits) return null
  const normalized = digits.length === 10 ? `91${digits}` : digits
  return normalized.length >= 10 && normalized.length <= 15 ? normalized : null
}

function configuredTemplate(key: string, fallback: string) {
  return process.env[`META_WHATSAPP_TEMPLATE_${key}`] || fallback
}

export async function sendWhatsAppTemplate(
  phone: string | undefined | null,
  template: WhatsAppTemplate,
): Promise<boolean> {
  const recipient = normalizePhone(phone)
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID

  if (!recipient || !token || !phoneNumberId) return false

  const version = process.env.META_WHATSAPP_API_VERSION || DEFAULT_API_VERSION
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language || process.env.META_WHATSAPP_TEMPLATE_LANGUAGE || "en_US" },
          ...(template.parameters?.length
            ? { components: [{ type: "body", parameters: template.parameters.map((text) => ({ type: "text", text: String(text) })) }] }
            : {}),
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] WhatsApp template failed", { status: response.status, recipientLast4: recipient.slice(-4), error: errorBody.slice(0, 500) })
      return false
    }

    return true
  } catch (error) {
    console.error("[v0] WhatsApp request failed", { recipientLast4: recipient.slice(-4), error: error instanceof Error ? error.message : String(error) })
    return false
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendOrderConfirmationWhatsApp(data: { phone?: string; customerName: string; orderId: string; totalAmount: number }) {
  return sendWhatsAppTemplate(data.phone, { name: configuredTemplate("ORDER_CONFIRMATION", "order_confirmation"), parameters: [data.customerName, data.orderId, `₹${data.totalAmount.toFixed(2)}`] })
}

export async function sendOrderStatusWhatsApp(data: { phone?: string; customerName: string; orderId: string; status: string; trackingNumber?: string }) {
  return sendWhatsAppTemplate(data.phone, { name: configuredTemplate("ORDER_STATUS", "order_status_update"), parameters: [data.customerName, data.orderId, data.status, data.trackingNumber || "Not available"] })
}

export async function sendOrderCancellationWhatsApp(data: { phone?: string; customerName: string; orderId: string; totalAmount: number }) {
  return sendWhatsAppTemplate(data.phone, { name: configuredTemplate("ORDER_CANCELLATION", "order_cancelled"), parameters: [data.customerName, data.orderId, `₹${data.totalAmount.toFixed(2)}`] })
}

export async function sendWelcomeWhatsApp(phone: string | undefined, fullname: string) {
  return sendWhatsAppTemplate(phone, { name: configuredTemplate("WELCOME", "welcome_message"), parameters: [fullname] })
}

export async function sendOtpWhatsApp(phone: string | undefined, otp: string, userName: string) {
  return sendWhatsAppTemplate(phone, { name: configuredTemplate("OTP", "login_otp"), parameters: [userName, otp] })
}

export async function sendPasswordResetConfirmationWhatsApp(phone: string | undefined, userName: string) {
  return sendWhatsAppTemplate(phone, { name: configuredTemplate("PASSWORD_RESET", "password_reset_confirmation"), parameters: [userName] })
}

export { normalizePhone }
