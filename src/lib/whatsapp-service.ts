import "server-only"

const DEFAULT_API_VERSION = "v23.0"
const DEFAULT_TEMPLATE_LANGUAGE = "en"
const REQUEST_TIMEOUT_MS = 8000

type TemplateParameter = string | number

type TemplateConfig = {
  name: string
  language: string
  parameterCount: number
}

const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  ORDER_CONFIRMATION: { name: "order_confirmation", language: "en", parameterCount: 3 },
  ORDER_CANCELLATION: { name: "order_cancelled", language: "en", parameterCount: 2 },
  WELCOME: { name: "welcome_message", language: "en", parameterCount: 1 },
  OTP: { name: "login_otp", language: "en", parameterCount: 2 },
  PASSWORD_RESET: { name: "password_reset_confirmation", language: "en", parameterCount: 1 },
  ORDER_STATUS: { name: "order_status_update", language: "en", parameterCount: 2 },
  ORDER_RECEIVED: { name: "order_received", language: "en", parameterCount: 2 },
  ORDER_PROCESSING: { name: "order_processing", language: "en", parameterCount: 2 },
  ORDER_SHIPPED: { name: "order_shipped", language: "en", parameterCount: 2 },
  ORDER_IN_TRANSIT: { name: "order_in_transit", language: "en", parameterCount: 2 },
  ORDER_DELIVERED: { name: "order_delivered", language: "en", parameterCount: 2 },
  PAYMENT_FAILED: { name: "payment_failed", language: "en", parameterCount: 2 },
}

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

function configuredTemplateOverride(key: string) {
  return process.env[`META_WHATSAPP_TEMPLATE_${key}`]?.trim() || null
}

function configuredParameterCount(key: string, fallback: number) {
  const value = Number.parseInt(process.env[`META_WHATSAPP_TEMPLATE_${key}_PARAMS`] || "", 10)
  return Number.isInteger(value) && value >= 0 && value <= 7 ? value : fallback
}

function parametersForTemplate(key: string, values: TemplateParameter[]) {
  const config = TEMPLATE_CONFIGS[key] || TEMPLATE_CONFIGS.ORDER_STATUS
  return values.slice(0, configuredParameterCount(key, config.parameterCount))
}

function resolveTemplate(key: string): TemplateConfig {
  const config = TEMPLATE_CONFIGS[key] || TEMPLATE_CONFIGS.ORDER_STATUS
  return {
    name: process.env[`META_WHATSAPP_TEMPLATE_${key}`]?.trim() || config.name,
    language:
      process.env[`META_WHATSAPP_TEMPLATE_${key}_LANGUAGE`]?.trim() ||
      process.env.META_WHATSAPP_TEMPLATE_LANGUAGE?.trim() ||
      config.language ||
      DEFAULT_TEMPLATE_LANGUAGE,
    parameterCount: configuredParameterCount(key, config.parameterCount),
  }
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
          language: { code: template.language || DEFAULT_TEMPLATE_LANGUAGE },
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
  const key = "ORDER_CONFIRMATION"
  const template = resolveTemplate(key)
  return sendWhatsAppTemplate(data.phone, {
    name: template.name,
    language: template.language,
    parameters: parametersForTemplate(key, [data.customerName, "purchase", `#${data.orderId}`]),
  })
}

export const ORDER_STATUS_CATALOG = {
  pending: { label: "Order received", templateKey: "ORDER_RECEIVED" },
  order_received: { label: "Order received", templateKey: "ORDER_RECEIVED" },
  processing: { label: "Order processing", templateKey: "ORDER_PROCESSING" },
  order_processing: { label: "Order processing", templateKey: "ORDER_PROCESSING" },
  shipped: { label: "Shipped", templateKey: "ORDER_SHIPPED" },
  "in-transit": { label: "In transit", templateKey: "ORDER_IN_TRANSIT" },
  delivered: { label: "Delivered", templateKey: "ORDER_DELIVERED" },
  cancelled: { label: "Cancelled", templateKey: "ORDER_CANCELLATION" },
  payment_failed: { label: "Payment failed", templateKey: "PAYMENT_FAILED" },
} as const

export type OrderStatus = keyof typeof ORDER_STATUS_CATALOG

export function getOrderStatusLabel(status: string) {
  return ORDER_STATUS_CATALOG[status as OrderStatus]?.label || status.replaceAll("_", " ").replace("-", " ")
}

export async function sendOrderStatusWhatsApp(data: {
  phone?: string
  customerName: string
  orderId: string
  status: string
  trackingNumber?: string
  trackingUrl?: string
  shippingProvider?: string
  notes?: string
}) {
  const statusInfo = ORDER_STATUS_CATALOG[data.status as OrderStatus] || {
    label: getOrderStatusLabel(data.status),
    templateKey: "ORDER_STATUS",
  }
  const tracking = data.trackingNumber || "Not available"
  const provider = data.shippingProvider || "Not available"
  const trackingLink = data.trackingUrl || "Not available"
  const genericTemplate = configuredTemplateOverride("ORDER_STATUS")
  const statusTemplate = configuredTemplateOverride(statusInfo.templateKey)
  const templateName = statusTemplate || genericTemplate || "order_status_update"

  const templateKey = statusTemplate ? statusInfo.templateKey : genericTemplate ? "ORDER_STATUS" : statusInfo.templateKey
  // Meta requires the body parameter count to exactly match the approved template.
  // The default status template uses five values, while *_PARAMS allows a local
  // template with a different approved body shape (for example, three values).
  const values = [data.customerName, data.orderId, statusInfo.label, tracking, trackingLink]
  const parameterKey = statusTemplate ? statusInfo.templateKey : "ORDER_STATUS"
  // The approved order-status templates use exactly two body variables.
  // Do not honor a stale *_PARAMS environment value here, because sending a
  // third variable causes Meta error 132000 when the template expects two.
  const template = resolveTemplate(statusTemplate ? statusInfo.templateKey : "ORDER_STATUS")
  const statusParameters = [data.customerName, `#${data.orderId}`]

  return sendWhatsAppTemplate(data.phone, {
    name: templateName || template.name,
    language: template.language,
    parameters: parametersForTemplate(statusTemplate ? statusInfo.templateKey : "ORDER_STATUS", statusParameters),
  })
}

export async function sendOrderCancellationWhatsApp(data: { phone?: string; customerName: string; orderId: string; totalAmount: number }) {
  const key = "ORDER_CANCELLATION"
  const template = resolveTemplate(key)
  return sendWhatsAppTemplate(data.phone, {
    name: template.name,
    language: template.language,
    parameters: parametersForTemplate(key, [data.customerName, `#${data.orderId}`]),
  })
}

export async function sendWelcomeWhatsApp(phone: string | undefined, fullname: string) {
  const key = "WELCOME"
  const template = resolveTemplate(key)
  return sendWhatsAppTemplate(phone, {
    name: template.name,
    language: template.language,
    parameters: parametersForTemplate(key, [fullname]),
  })
}

export async function sendOtpWhatsApp(phone: string | undefined, otp: string, userName: string) {
  const key = "OTP"
  const template = resolveTemplate(key)
  return sendWhatsAppTemplate(phone, {
    name: template.name,
    language: template.language,
    parameters: parametersForTemplate(key, [userName, otp]),
  })
}

export async function sendPasswordResetConfirmationWhatsApp(phone: string | undefined, userName: string) {
  const key = "PASSWORD_RESET"
  const template = resolveTemplate(key)
  return sendWhatsAppTemplate(phone, {
    name: template.name,
    language: template.language,
    parameters: parametersForTemplate(key, [userName]),
  })
}

export { normalizePhone }
