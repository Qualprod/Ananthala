import { NextResponse } from "next/server"

const MAX_BODY_BYTES = 256_000

function getVerifyToken() {
  return process.env.META_WHATSAPP_VERIFY_TOKEN?.trim() || null
}

function safeEventSummary(payload: unknown) {
  if (!payload || typeof payload !== "object") return { type: "unknown" }

  const body = payload as {
    entry?: Array<{
      id?: string
      changes?: Array<{
        field?: string
        value?: {
          statuses?: Array<{ id?: string; status?: string; recipient_id?: string; errors?: unknown[] }>
          messages?: Array<{ id?: string; from?: string; type?: string }>
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
          recipientLast4: status.recipient_id?.slice(-4),
          hasErrors: Boolean(status.errors?.length),
        })),
        ...(value.messages || []).map((message) => ({
          field: change.field,
          type: "message",
          messageId: message.id,
          messageType: message.type,
          senderLast4: message.from?.slice(-4),
        })),
      ]
    }),
  )

  return { object: "whatsapp_business_account", events }
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
    console.log("WhatsApp webhook event", safeEventSummary(payload))
    return NextResponse.json({ received: true })
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
  }
}
