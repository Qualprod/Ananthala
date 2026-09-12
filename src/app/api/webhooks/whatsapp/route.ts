import { NextResponse } from "next/server"

const MAX_BODY_BYTES = 256_000

function getVerifyToken() {
  return process.env.META_WHATSAPP_VERIFY_TOKEN?.trim() || null
}

type WhatsAppStatusError = {
  code?: number | string
  title?: string
  message?: string
  error_data?: { details?: string }
}

function safeString(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.slice(0, maxLength) : undefined
}

function safeEventSummary(payload: unknown) {
  if (!payload || typeof payload !== "object") return { type: "unknown", eventCount: 0 }

  const body = payload as {
    object?: string
    entry?: Array<{
      id?: string
      changes?: Array<{
        field?: string
        value?: {
          messaging_product?: string
          metadata?: { phone_number_id?: string; display_phone_number?: string }
          statuses?: Array<{
            id?: string
            status?: string
            timestamp?: string
            recipient_id?: string
            conversation?: { id?: string; origin?: { type?: string } }
            pricing?: { billable?: boolean; category?: string; pricing_model?: string }
            errors?: WhatsAppStatusError[]
          }>
          messages?: Array<{ id?: string; from?: string; type?: string; timestamp?: string }>
        }
      }>
    }>
  }

  const events = (body.entry || []).flatMap((entry) =>
    (entry.changes || []).flatMap((change) => {
      const value = change.value || {}
      return [
        ...(value.statuses || []).map((status) => ({
          field: change.field,
          type: "status",
          messageId: status.id,
          status: status.status,
          eventTimestamp: status.timestamp,
          recipientLast4: status.recipient_id?.slice(-4),
          conversationId: status.conversation?.id,
          conversationOrigin: status.conversation?.origin?.type,
          billable: status.pricing?.billable,
          pricingCategory: status.pricing?.category,
          error: status.errors?.[0]
            ? {
                code: status.errors[0].code,
                title: safeString(status.errors[0].title),
                message: safeString(status.errors[0].message),
                details: safeString(status.errors[0].error_data?.details),
              }
            : undefined,
        })),
        ...(value.messages || []).map((message) => ({
          field: change.field,
          type: "message",
          messageId: message.id,
          messageType: message.type,
          eventTimestamp: message.timestamp,
          senderLast4: message.from?.slice(-4),
        })),
      ]
    }),
  )

  return {
    object: body.object || "whatsapp_business_account",
    eventCount: events.length,
    entries: body.entry?.length || 0,
    events,
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")
  const expectedToken = getVerifyToken()

  if (mode === "subscribe" && expectedToken && token === expectedToken && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
  }

  return new Response("Forbidden", { status: 403 })
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  }

  try {
    const payload = await request.json()
    const summary = safeEventSummary(payload)
    const requestId = request.headers.get("x-vercel-id") || request.headers.get("x-fb-trace-id") || undefined
    const logContext = { requestId, ...summary }

    console.log("WhatsApp webhook received", logContext)

    if (summary.events.some((event) => event.type === "status" && event.status === "failed")) {
      console.error("[v0] WhatsApp delivery failure webhook", logContext)
    } else if (summary.events.some((event) => event.type === "status")) {
      console.log("[v0] WhatsApp delivery status webhook", logContext)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("WhatsApp webhook rejected invalid JSON", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }
}
