import "server-only"

import crypto from "crypto"
import type { NextRequest } from "next/server"
import { connectDB } from "@/lib/mongodb"
import { verifyToken } from "@/lib/jwt"
import { normalizePhone } from "@/lib/whatsapp-service"
import WhatsAppConversation from "@/models/WhatsAppConversation"
import WhatsAppMessage, { STATUS_RANK } from "@/models/WhatsAppMessage"

/* ------------------------------------------------------------------------------------------------
 * Configuration (re-uses the same env variables as lib/whatsapp-service.ts)
 *   META_WHATSAPP_ACCESS_TOKEN            – System User token with whatsapp_business_messaging
 *   META_WHATSAPP_PHONE_NUMBER_ID         – Phone Number ID (NOT the phone number)
 *   META_WHATSAPP_API_VERSION             – optional, defaults to v23.0
 * New, optional:
 *   META_WHATSAPP_BUSINESS_ACCOUNT_ID     – WABA ID, lets the inbox list your approved templates
 *   META_APP_SECRET                       – App secret, enables X-Hub-Signature-256 verification
 * ---------------------------------------------------------------------------------------------- */

const DEFAULT_API_VERSION = "v23.0"
const REQUEST_TIMEOUT_MS = 10000
export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000
export const MAX_TEXT_LENGTH = 4096

function apiVersion() {
  return (process.env.META_WHATSAPP_API_VERSION || DEFAULT_API_VERSION).trim()
}

function accessToken() {
  const value = process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.CURL_AUTH_HEADER
  if (!value) return null
  const token = value.trim().replace(/^Bearer\s+/i, "").replace(/^['"]|['"]$/g, "")
  return token || null
}

function phoneNumberId() {
  return process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() || null
}

function wabaId() {
  return process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || null
}

function graphUrl(path: string) {
  return `https://graph.facebook.com/${apiVersion()}/${path.replace(/^\//, "")}`
}

/* ------------------------------------------------------------------------------------------------
 * Admin auth (same rules as the other /api/admin routes: admin_token cookie with role "admin")
 * ---------------------------------------------------------------------------------------------- */

export function getAdminFromRequest(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value
  if (!token) return null
  const decoded = verifyToken(token)
  if (!decoded || decoded.role !== "admin") return null
  return { id: String(decoded.userId || decoded.id || ""), name: decoded.fullname, email: decoded.email }
}

/* ------------------------------------------------------------------------------------------------
 * Meta error mapping → message an admin can act on
 * ---------------------------------------------------------------------------------------------- */

const META_ERROR_HINTS: Record<number, string> = {
  190: "Access token expired or invalid. Generate a new System User token in Meta Business Settings.",
  131047: "More than 24 hours have passed since the customer last messaged. Send an approved template instead.",
  131026: "Message undeliverable. The number may not be on WhatsApp or hasn't accepted the latest terms.",
  131030: "Recipient not in the allowed list. While your app is in test mode, add this number in API Setup.",
  131051: "Unsupported message type.",
  131053: "Media upload error.",
  131056: "Too many messages to this customer in a short time. Wait a moment and try again.",
  131009: "A parameter value is invalid.",
  131008: "A required parameter is missing.",
  131000: "Something went wrong at Meta. Try again in a moment.",
  132000: "Number of template variables does not match the approved template.",
  132001: "Template does not exist in that language, or isn't approved yet.",
  132005: "Template text is too long after filling in the variables.",
  132007: "Template content violates WhatsApp policy.",
  132012: "Template variable format mismatch.",
  132015: "Template is paused because of low quality.",
  132016: "Template is disabled.",
  133010: "Phone number not registered on the Cloud API.",
  130429: "Rate limit hit. Slow down and retry.",
  131048: "Spam rate limit hit. Too many messages were blocked or reported by users.",
  368: "Account temporarily restricted for policy violations.",
  100: "Invalid request parameter.",
}

export function describeMetaError(code?: number, fallback?: string) {
  if (code && META_ERROR_HINTS[code]) return META_ERROR_HINTS[code]
  return fallback || "WhatsApp rejected the message."
}

type GraphResult<T> = { ok: true; data: T } | { ok: false; status: number; code?: number; message: string }

async function graphFetch<T>(path: string, init: RequestInit = {}): Promise<GraphResult<T>> {
  const token = accessToken()
  if (!token) return { ok: false, status: 500, message: "WhatsApp is not configured: META_WHATSAPP_ACCESS_TOKEN is missing." }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(path.startsWith("http") ? path : graphUrl(path), {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
      signal: controller.signal,
      cache: "no-store",
    })
    const body = (await response.json().catch(() => null)) as any
    if (!response.ok) {
      const code = Number(body?.error?.code) || undefined
      const metaMessage = body?.error?.error_data?.details || body?.error?.message
      return { ok: false, status: response.status, code, message: describeMetaError(code, metaMessage) }
    }
    return { ok: true, data: body as T }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError"
    return { ok: false, status: aborted ? 504 : 502, message: aborted ? "WhatsApp API timed out." : "Could not reach WhatsApp API." }
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------------------------------------
 * Webhook: signature verification + ingestion
 * ---------------------------------------------------------------------------------------------- */

/**
 * Verifies Meta's X-Hub-Signature-256 header when META_APP_SECRET is set.
 * If the secret is not configured the check is skipped so existing setups keep working.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const secret = (process.env.META_APP_SECRET || process.env.META_WHATSAPP_APP_SECRET)?.trim()
  if (!secret) return true
  if (!signatureHeader?.startsWith("sha256=")) return false
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  const received = signatureHeader.slice("sha256=".length)
  const a = Buffer.from(expected, "hex")
  const b = Buffer.from(received, "hex")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

type ParsedInbound = {
  type: string
  text: string
  caption: string
  media: { id?: string; mimeType?: string; filename?: string; voice?: boolean } | null
  location: { latitude?: number; longitude?: number; name?: string; address?: string } | null
  preview: string
}

const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"] as const
const MEDIA_LABELS: Record<string, string> = {
  image: "📷 Photo",
  video: "🎥 Video",
  audio: "🎤 Audio",
  document: "📄 Document",
  sticker: "Sticker",
}

function parseInboundMessage(message: any): ParsedInbound {
  const type = String(message?.type || "unknown")
  const result: ParsedInbound = { type, text: "", caption: "", media: null, location: null, preview: "" }

  if (type === "text") {
    result.text = message.text?.body || ""
  } else if ((MEDIA_TYPES as readonly string[]).includes(type)) {
    const m = message[type] || {}
    result.media = { id: m.id, mimeType: m.mime_type, filename: m.filename, voice: Boolean(m.voice) }
    result.caption = m.caption || ""
  } else if (type === "location") {
    const l = message.location || {}
    result.location = { latitude: l.latitude, longitude: l.longitude, name: l.name, address: l.address }
    result.text = [l.name, l.address].filter(Boolean).join(", ")
  } else if (type === "interactive") {
    const i = message.interactive || {}
    result.text = i.button_reply?.title || i.list_reply?.title || i.nfm_reply?.body || "Interactive reply"
  } else if (type === "button") {
    result.text = message.button?.text || message.button?.payload || "Button reply"
  } else if (type === "contacts") {
    const names = (message.contacts || []).map((c: any) => c?.name?.formatted_name).filter(Boolean)
    const phones = (message.contacts || []).flatMap((c: any) => (c?.phones || []).map((p: any) => p?.phone)).filter(Boolean)
    result.text = `Contact: ${[names.join(", "), phones.join(", ")].filter(Boolean).join(" · ")}`
  } else if (type === "order") {
    const items = message.order?.product_items?.length || 0
    result.text = `🛒 Catalog order (${items} item${items === 1 ? "" : "s"})`
  } else {
    result.text = message.errors?.[0]?.title || "Unsupported message type"
  }

  if (result.media) {
    result.preview = result.caption || result.media.filename || (result.media.voice ? "🎤 Voice message" : MEDIA_LABELS[type])
  } else if (type === "location") {
    result.preview = `📍 ${result.text || "Location"}`
  } else {
    result.preview = result.text
  }
  return result
}

function preview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 140)
}

/** Stores messages and delivery statuses from a webhook payload. Idempotent (safe for Meta retries). */
export async function ingestWebhookPayload(payload: any) {
  if (!payload || payload.object !== "whatsapp_business_account") return
  const ourPhoneNumberId = phoneNumberId()

  const changes = (payload.entry || []).flatMap((entry: any) => entry?.changes || [])
  const relevant = changes.filter((change: any) => {
    if (change?.field !== "messages") return false
    const incomingId = change?.value?.metadata?.phone_number_id
    return !ourPhoneNumberId || !incomingId || incomingId === ourPhoneNumberId
  })
  if (!relevant.length) return

  await connectDB()

  for (const change of relevant) {
    const value = change.value || {}
    const contactNames = new Map<string, string>()
    for (const contact of value.contacts || []) {
      if (contact?.wa_id) contactNames.set(String(contact.wa_id), contact?.profile?.name || "")
    }

    for (const message of value.messages || []) {
      try {
        await ingestInboundMessage(message, contactNames)
      } catch (error) {
        console.error("WhatsApp inbox: failed to store inbound message", {
          messageId: message?.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    for (const status of value.statuses || []) {
      try {
        await ingestStatus(status)
      } catch (error) {
        console.error("WhatsApp inbox: failed to store status", {
          messageId: status?.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }
}

async function ingestInboundMessage(message: any, contactNames: Map<string, string>) {
  const wamid = message?.id
  const waId = message?.from ? String(message.from) : null
  if (!wamid || !waId) return

  // Never trust a timestamp from the future (it would stretch the 24h reply window).
  const sentAt = Number(message.timestamp) * 1000
  const timestamp = new Date(Number.isFinite(sentAt) && sentAt > 0 ? Math.min(sentAt, Date.now()) : Date.now())

  // Reactions update the message they react to instead of becoming a new bubble.
  if (message.type === "reaction") {
    const target = message.reaction?.message_id
    if (target) {
      await WhatsAppMessage.updateOne({ wamid: target }, { $set: { reaction: message.reaction?.emoji || null } })
    }
    return
  }

  const parsed = parseInboundMessage(message)
  const insert = await WhatsAppMessage.updateOne(
    { wamid },
    {
      $setOnInsert: {
        wamid,
        waId,
        direction: "inbound",
        type: parsed.type,
        text: parsed.text,
        caption: parsed.caption,
        media: parsed.media,
        location: parsed.location,
        contextWamid: message.context?.id || null,
        status: "received",
        statusRank: 0,
        timestamp,
      },
    },
    { upsert: true },
  )

  // Duplicate delivery from Meta: message already stored, don't touch the conversation counters again.
  if (!insert.upsertedCount) return

  const profileName = contactNames.get(waId)
  const conversation = await WhatsAppConversation.findOneAndUpdate(
    { waId },
    {
      $setOnInsert: { waId },
      $max: { lastInboundAt: timestamp },
      $inc: { unreadCount: 1 },
      ...(profileName ? { $set: { profileName } } : {}),
    },
    { upsert: true, new: true },
  )

  // Only move the "last message" pointer forward in time (webhooks can arrive out of order).
  if (!conversation.lastMessageAt || conversation.lastMessageAt <= timestamp) {
    await WhatsAppConversation.updateOne(
      { waId },
      {
        $set: {
          lastMessageAt: timestamp,
          lastMessageText: preview(parsed.preview),
          lastMessageDirection: "inbound",
          lastMessageStatus: "received",
          lastInboundWamid: wamid,
        },
      },
    )
  }
}

async function ingestStatus(status: any) {
  const wamid = status?.id
  const next = String(status?.status || "")
  if (!wamid || !(next in STATUS_RANK)) return

  const rank = STATUS_RANK[next]
  const errorInfo = status.errors?.[0]
  const update: Record<string, unknown> = { status: next, statusRank: rank }
  if (next === "failed") {
    const code = Number(errorInfo?.code) || undefined
    update.error = {
      code,
      title: errorInfo?.title || "Failed",
      message: describeMetaError(code, errorInfo?.error_data?.details || errorInfo?.message),
    }
  }

  // Never move a status backwards (e.g. a late "delivered" after "read").
  const updated = await WhatsAppMessage.findOneAndUpdate(
    { wamid, direction: "outbound", statusRank: { $lt: rank } },
    { $set: update },
    { new: true },
  )
  if (!updated) return

  await WhatsAppConversation.updateOne(
    { waId: updated.waId, lastMessageDirection: "outbound", lastMessageAt: updated.timestamp },
    { $set: { lastMessageStatus: next } },
  )
}

/* ------------------------------------------------------------------------------------------------
 * Sending
 * ---------------------------------------------------------------------------------------------- */

export function isWindowOpen(lastInboundAt?: Date | string | null) {
  if (!lastInboundAt) return false
  return Date.now() - new Date(lastInboundAt).getTime() < CUSTOMER_SERVICE_WINDOW_MS
}

type SendOutcome =
  | { ok: true; message: any }
  | { ok: false; status: number; code?: number | string; message: string }

async function postMessage(body: Record<string, unknown>) {
  const id = phoneNumberId()
  if (!id) {
    return { ok: false as const, status: 500, message: "WhatsApp is not configured: META_WHATSAPP_PHONE_NUMBER_ID is missing." }
  }
  return graphFetch<{ messages?: Array<{ id?: string }>; contacts?: Array<{ wa_id?: string }> }>(`${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...body }),
  })
}

async function recordOutbound(params: {
  wamid: string
  waId: string
  type: string
  text: string
  template?: { name: string; language: string } | null
  contextWamid?: string | null
  admin: { id: string; name: string; email: string }
}) {
  const timestamp = new Date()
  const doc = await WhatsAppMessage.create({
    wamid: params.wamid,
    waId: params.waId,
    direction: "outbound",
    type: params.type,
    text: params.text,
    template: params.template || null,
    contextWamid: params.contextWamid || null,
    status: "accepted",
    statusRank: STATUS_RANK.accepted,
    sentBy: params.admin,
    timestamp,
  })
  await WhatsAppConversation.updateOne(
    { waId: params.waId },
    {
      $setOnInsert: { waId: params.waId, unreadCount: 0 },
      $set: {
        lastMessageAt: timestamp,
        lastMessageText: preview(params.text),
        lastMessageDirection: "outbound",
        lastMessageStatus: "accepted",
      },
    },
    { upsert: true },
  )
  return doc.toObject()
}

export async function sendTextReply(input: {
  waId: string
  text: string
  contextWamid?: string | null
  admin: { id: string; name: string; email: string }
}): Promise<SendOutcome> {
  const waId = normalizePhone(input.waId)
  const text = input.text?.trim() || ""
  if (!waId) return { ok: false, status: 400, message: "Invalid WhatsApp number." }
  if (!text) return { ok: false, status: 400, message: "Message cannot be empty." }
  if (text.length > MAX_TEXT_LENGTH) return { ok: false, status: 400, message: `Message is longer than ${MAX_TEXT_LENGTH} characters.` }

  await connectDB()
  const conversation = await WhatsAppConversation.findOne({ waId }).lean()

  // Meta policy: free-form messages are only allowed within 24h of the customer's last message.
  if (!isWindowOpen(conversation?.lastInboundAt)) {
    return {
      ok: false,
      status: 409,
      code: "WINDOW_CLOSED",
      message: "The 24-hour customer service window is closed. Send an approved template to restart the conversation.",
    }
  }

  const result = await postMessage({
    to: waId,
    type: "text",
    text: { body: text, preview_url: /https?:\/\//i.test(text) },
    ...(input.contextWamid ? { context: { message_id: input.contextWamid } } : {}),
  })
  if (!result.ok) return { ok: false, status: result.status, code: result.code, message: result.message }

  const wamid = result.data.messages?.[0]?.id
  if (!wamid) return { ok: false, status: 502, message: "WhatsApp did not return a message id." }

  const message = await recordOutbound({ wamid, waId, type: "text", text, contextWamid: input.contextWamid, admin: input.admin })
  return { ok: true, message }
}

export type TemplateSendInput = {
  waId: string
  name: string
  language: string
  headerParams?: string[]
  bodyParams?: string[]
  /** "POSITIONAL" ({{1}}) or "NAMED" ({{customer_name}}) */
  parameterFormat?: "POSITIONAL" | "NAMED"
  headerParamNames?: string[]
  bodyParamNames?: string[]
  previewText?: string
  admin: { id: string; name: string; email: string }
}

export async function sendTemplateMessage(input: TemplateSendInput): Promise<SendOutcome> {
  const waId = normalizePhone(input.waId)
  if (!waId) return { ok: false, status: 400, message: "Invalid WhatsApp number." }
  if (!input.name?.trim()) return { ok: false, status: 400, message: "Choose a template." }

  const named = input.parameterFormat === "NAMED"
  const toParams = (values: string[] = [], names: string[] = []) =>
    values.map((value, index) => ({
      type: "text",
      text: String(value ?? "").trim(),
      ...(named && names[index] ? { parameter_name: names[index] } : {}),
    }))

  if ([...(input.headerParams || []), ...(input.bodyParams || [])].some((v) => !String(v ?? "").trim())) {
    return { ok: false, status: 400, message: "Fill in every template variable." }
  }

  const components: any[] = []
  if (input.headerParams?.length) components.push({ type: "header", parameters: toParams(input.headerParams, input.headerParamNames) })
  if (input.bodyParams?.length) components.push({ type: "body", parameters: toParams(input.bodyParams, input.bodyParamNames) })

  await connectDB()
  const result = await postMessage({
    to: waId,
    type: "template",
    template: {
      name: input.name.trim(),
      language: { code: input.language?.trim() || "en" },
      ...(components.length ? { components } : {}),
    },
  })
  if (!result.ok) return { ok: false, status: result.status, code: result.code, message: result.message }

  const wamid = result.data.messages?.[0]?.id
  if (!wamid) return { ok: false, status: 502, message: "WhatsApp did not return a message id." }

  const message = await recordOutbound({
    wamid,
    waId,
    type: "template",
    text: input.previewText?.trim() || `Template: ${input.name}`,
    template: { name: input.name, language: input.language },
    admin: input.admin,
  })
  return { ok: true, message }
}

/** Sends a read receipt (blue ticks for the customer). Best-effort; failures are only logged. */
export async function markInboundAsRead(wamid?: string | null) {
  if (!wamid) return
  const result = await postMessage({ status: "read", message_id: wamid })
  if (!result.ok) console.warn("WhatsApp inbox: read receipt failed", { code: result.code, message: result.message })
}

/* ------------------------------------------------------------------------------------------------
 * Templates
 * ---------------------------------------------------------------------------------------------- */

export type InboxTemplate = {
  name: string
  language: string
  category: string
  parameterFormat: "POSITIONAL" | "NAMED"
  headerText: string | null
  headerVariables: string[]
  headerFormat: string | null
  bodyText: string
  bodyVariables: string[]
  footerText: string | null
  buttons: string[]
  supported: boolean
  unsupportedReason?: string
}

let templateCache: { at: number; data: InboxTemplate[] } | null = null
const TEMPLATE_CACHE_MS = 5 * 60 * 1000

function extractVariables(text?: string | null) {
  if (!text) return []
  const found: string[] = []
  for (const match of text.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
    if (!found.includes(match[1])) found.push(match[1])
  }
  // Positional variables must be sent in numeric order.
  return found.every((v) => /^\d+$/.test(v)) ? found.sort((a, b) => Number(a) - Number(b)) : found
}

export async function listApprovedTemplates(force = false): Promise<{ ok: true; templates: InboxTemplate[] } | { ok: false; message: string; configured: boolean }> {
  const id = wabaId()
  if (!id) {
    return { ok: false, configured: false, message: "Set META_WHATSAPP_BUSINESS_ACCOUNT_ID to load your approved templates automatically." }
  }
  if (!force && templateCache && Date.now() - templateCache.at < TEMPLATE_CACHE_MS) {
    return { ok: true, templates: templateCache.data }
  }

  const result = await graphFetch<{ data?: any[] }>(
    `${id}/message_templates?status=APPROVED&limit=250&fields=name,language,status,category,components,parameter_format`,
  )
  if (!result.ok) return { ok: false, configured: true, message: result.message }

  const templates: InboxTemplate[] = (result.data.data || [])
    .filter((t) => t?.status === "APPROVED")
    .map((t) => {
      const components: any[] = t.components || []
      const header = components.find((c) => c.type === "HEADER")
      const body = components.find((c) => c.type === "BODY")
      const footer = components.find((c) => c.type === "FOOTER")
      const buttons = components.find((c) => c.type === "BUTTONS")?.buttons || []
      const headerFormat = header?.format || null
      const headerText = headerFormat === "TEXT" ? header?.text || "" : null

      let unsupportedReason: string | undefined
      if (headerFormat && headerFormat !== "TEXT") unsupportedReason = `${headerFormat.toLowerCase()} header`
      if (buttons.some((b: any) => (b.type === "URL" && /{{/.test(b.url || "")) || ["COPY_CODE", "OTP", "FLOW", "CATALOG", "MPM"].includes(b.type))) {
        unsupportedReason = "dynamic button"
      }

      return {
        name: t.name,
        language: t.language,
        category: t.category,
        parameterFormat: t.parameter_format === "NAMED" ? "NAMED" : "POSITIONAL",
        headerText,
        headerVariables: extractVariables(headerText),
        headerFormat,
        bodyText: body?.text || "",
        bodyVariables: extractVariables(body?.text),
        footerText: footer?.text || null,
        buttons: buttons.map((b: any) => b.text).filter(Boolean),
        supported: !unsupportedReason,
        unsupportedReason,
      } satisfies InboxTemplate
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  templateCache = { at: Date.now(), data: templates }
  return { ok: true, templates }
}

/* ------------------------------------------------------------------------------------------------
 * Media download (Meta media URLs need the access token, so the browser can't load them directly)
 * ---------------------------------------------------------------------------------------------- */

export async function downloadMedia(mediaId: string) {
  const meta = await graphFetch<{ url?: string; mime_type?: string }>(`${mediaId}`)
  if (!meta.ok || !meta.data.url) return null

  const token = accessToken()
  const response = await fetch(meta.data.url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  if (!response.ok || !response.body) return null
  return {
    body: response.body,
    contentType: response.headers.get("content-type") || meta.data.mime_type || "application/octet-stream",
    contentLength: response.headers.get("content-length"),
  }
}
