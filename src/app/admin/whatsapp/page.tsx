"use client"

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  RefreshCw,
  Reply,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/* ------------------------------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------------------------- */

type Conversation = {
  _id?: string
  waId: string
  profileName?: string
  lastInboundAt?: string | null
  lastMessageAt?: string | null
  lastMessageText?: string
  lastMessageDirection?: "inbound" | "outbound"
  lastMessageStatus?: string
  unreadCount: number
  windowOpen: boolean
}

type ChatMessage = {
  _id: string
  wamid: string
  waId: string
  direction: "inbound" | "outbound"
  type: string
  text?: string
  caption?: string
  media?: { id?: string; mimeType?: string; filename?: string; voice?: boolean } | null
  location?: { latitude?: number; longitude?: number; name?: string; address?: string } | null
  template?: { name?: string; language?: string } | null
  contextWamid?: string | null
  reaction?: string | null
  status: string
  error?: { code?: number; title?: string; message?: string } | null
  sentBy?: { name?: string } | null
  timestamp: string
  pending?: boolean
}

type InboxTemplate = {
  name: string
  language: string
  category: string
  parameterFormat: "POSITIONAL" | "NAMED"
  headerText: string | null
  headerVariables: string[]
  bodyText: string
  bodyVariables: string[]
  footerText: string | null
  buttons: string[]
  supported: boolean
  unsupportedReason?: string
}

type Filter = "all" | "unread" | "open"

const WINDOW_MS = 24 * 60 * 60 * 1000
const LIST_POLL_MS = 6000
const THREAD_POLL_MS = 4000
const MAX_TEXT = 4096

/* ------------------------------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------------------------- */

function formatPhone(waId: string) {
  if (waId.startsWith("91") && waId.length === 12) return `+91 ${waId.slice(2, 7)} ${waId.slice(7)}`
  return `+${waId}`
}

function displayName(c: Pick<Conversation, "profileName" | "waId">) {
  return c.profileName?.trim() || formatPhone(c.waId)
}

function initials(name: string) {
  const clean = name.replace(/[^\p{L}\p{N} ]/gu, "").trim()
  if (!clean) return "#"
  const parts = clean.split(/\s+/)
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase()
}

const AVATAR_COLORS = ["#8B5A3C", "#A0522D", "#6B7F5E", "#7B6D8D", "#B07D62", "#5E7C8B", "#9C6B4E"]
function avatarColor(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function listTime(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  if (sameDay(d, now)) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return "Yesterday"
  if (now.getTime() - d.getTime() < 6 * WINDOW_MS) return d.toLocaleDateString("en-IN", { weekday: "short" })
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

function bubbleTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (sameDay(d, now)) return "Today"
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, yesterday)) return "Yesterday"
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

function windowRemaining(lastInboundAt?: string | null, now = Date.now()) {
  if (!lastInboundAt) return 0
  return Math.max(0, new Date(lastInboundAt).getTime() + WINDOW_MS - now)
}

function formatDuration(ms: number) {
  const totalMinutes = Math.floor(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fillTemplate(text: string, variables: string[], values: string[]) {
  let out = text
  variables.forEach((v, i) => {
    out = out.replace(new RegExp(`{{\\s*${v}\\s*}}`, "g"), values[i]?.trim() ? values[i] : `{{${v}}}`)
  })
  return out
}

function messagePreview(m: ChatMessage) {
  if (m.text) return m.text
  if (m.caption) return m.caption
  if (m.media?.filename) return m.media.filename
  return m.type === "image" ? "Photo" : m.type === "audio" ? "Audio" : m.type === "video" ? "Video" : m.type
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map<string, ChatMessage>()
  for (const m of existing) if (!m.pending) byId.set(m._id, m)
  for (const m of incoming) byId.set(m._id, m)
  const pending = existing.filter((m) => m.pending)
  return [...byId.values()]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .concat(pending)
}

class SessionExpiredError extends Error {}

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  })
  if (response.status === 401) throw new SessionExpiredError("Session expired")
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.message || "Request failed") as Error & { code?: string }
    error.code = data?.code
    throw error
  }
  return data as T
}

/* ------------------------------------------------------------------------------------------------
 * Small UI pieces
 * ---------------------------------------------------------------------------------------------- */

function Avatar({ name, seed, size = 44 }: { name: string; seed: string; size?: number }) {
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center text-white font-semibold select-none"
      style={{ width: size, height: size, background: avatarColor(seed), fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </div>
  )
}

function StatusTicks({ status, pending }: { status?: string; pending?: boolean }) {
  if (pending || status === "accepted") return <Clock className="h-3.5 w-3.5 text-[#8a7a6d]" aria-label="Sending" />
  if (status === "sent") return <Check className="h-4 w-4 text-[#8a7a6d]" aria-label="Sent" />
  if (status === "delivered") return <CheckCheck className="h-4 w-4 text-[#8a7a6d]" aria-label="Delivered" />
  if (status === "read") return <CheckCheck className="h-4 w-4 text-[#34B7F1]" aria-label="Read" />
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-red-600" aria-label="Failed" />
  return null
}

function WindowBadge({ lastInboundAt, now }: { lastInboundAt?: string | null; now: number }) {
  const remaining = windowRemaining(lastInboundAt, now)
  if (remaining > 0) {
    const urgent = remaining < 2 * 60 * 60 * 1000
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          urgent ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
        }`}
        title="Free-form replies are allowed until 24 hours after the customer's last message"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${urgent ? "bg-amber-500" : "bg-emerald-500"}`} />
        Reply window · {formatDuration(remaining)} left
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700"
      title="More than 24 hours since the customer's last message — only approved templates can be sent"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
      Window closed · template only
    </span>
  )
}

function MediaContent({ m }: { m: ChatMessage }) {
  if (!m.media?.id) {
    return <p className="text-sm italic text-[#8a7a6d]">Media unavailable</p>
  }
  const src = `/api/admin/whatsapp/media/${m.media.id}${m.media.filename ? `?filename=${encodeURIComponent(m.media.filename)}` : ""}`

  if (m.type === "image" || m.type === "sticker") {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={m.caption || "Customer photo"}
          loading="lazy"
          className={`rounded-lg object-cover bg-[#EFE7DF] ${m.type === "sticker" ? "h-32 w-32 bg-transparent" : "max-h-80 w-full min-w-[200px]"}`}
        />
      </a>
    )
  }
  if (m.type === "video") {
    return <video src={src} controls preload="metadata" className="max-h-80 w-full min-w-[220px] rounded-lg bg-black" />
  }
  if (m.type === "audio") {
    return <audio src={src} controls preload="none" className="w-64 max-w-full" />
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg bg-black/5 px-3 py-2.5 hover:bg-black/10 transition-colors"
    >
      <FileText className="h-8 w-8 shrink-0 text-[#8B5A3C]" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{m.media.filename || "Document"}</span>
        <span className="block text-xs text-[#8a7a6d]">{m.media.mimeType || "file"} · tap to download</span>
      </span>
    </a>
  )
}

function MessageBubble({
  m,
  quoted,
  onReply,
}: {
  m: ChatMessage
  quoted?: ChatMessage
  onReply: (m: ChatMessage) => void
}) {
  const outbound = m.direction === "outbound"
  const hasMedia = Boolean(m.media) && ["image", "video", "audio", "document", "sticker"].includes(m.type)
  const body = hasMedia ? m.caption : m.text

  return (
    <div className={`group flex ${outbound ? "justify-end" : "justify-start"} px-3 sm:px-6`}>
      <div className={`relative flex max-w-[85%] sm:max-w-[70%] items-end gap-1 ${outbound ? "flex-row-reverse" : ""}`}>
        <div
          className={`relative rounded-2xl px-3 pt-2 pb-1.5 shadow-[0_1px_1px_rgba(60,40,20,0.12)] ${
            outbound ? "rounded-tr-md bg-[#F3E3D3]" : "rounded-tl-md bg-white"
          } ${m.status === "failed" ? "ring-1 ring-red-300" : ""} ${m.reaction ? "mb-3" : ""}`}
        >
          {m.type === "template" && (
            <div className="mb-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-[#8B5A3C]">
              <Sparkles className="h-3 w-3" /> Template · {m.template?.name}
            </div>
          )}

          {quoted && (
            <div className={`mb-1.5 rounded-md border-l-4 border-[#8B5A3C] px-2 py-1 text-xs ${outbound ? "bg-white/50" : "bg-[#F5F1ED]"}`}>
              <div className="font-semibold text-[#8B5A3C]">{quoted.direction === "outbound" ? "You" : "Customer"}</div>
              <div className="line-clamp-2 text-[#5c4a3d]">{messagePreview(quoted)}</div>
            </div>
          )}

          {hasMedia && (
            <div className="mb-1">
              <MediaContent m={m} />
            </div>
          )}

          {m.type === "location" && m.location?.latitude != null && (
            <a
              href={`https://www.google.com/maps?q=${m.location.latitude},${m.location.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mb-1 flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm hover:bg-black/10"
            >
              <MapPin className="h-5 w-5 text-[#8B5A3C]" />
              <span>{m.location.name || m.location.address || "Open location in Maps"}</span>
            </a>
          )}

          {body && m.type !== "location" && (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-[#2b211b]">{body}</p>
          )}

          {m.status === "failed" && (
            <p className="mt-1 flex items-start gap-1 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Not delivered: {m.error?.message || m.error?.title || "WhatsApp rejected this message."}</span>
            </p>
          )}

          <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#8a7a6d]">
            {outbound && m.sentBy?.name && <span className="mr-1 hidden sm:inline">{m.sentBy.name.split(" ")[0]} ·</span>}
            <span>{bubbleTime(m.timestamp)}</span>
            {outbound && <StatusTicks status={m.status} pending={m.pending} />}
          </div>

          {m.reaction && (
            <span className="absolute -bottom-3 right-2 rounded-full border border-[#E5D5C5] bg-white px-1.5 text-sm shadow-sm">
              {m.reaction}
            </span>
          )}
        </div>

        {!m.pending && (
          <button
            type="button"
            onClick={() => onReply(m)}
            className="mb-1 rounded-full p-1.5 text-[#8a7a6d] opacity-0 transition-opacity hover:bg-black/5 group-hover:opacity-100 focus:opacity-100"
            aria-label="Reply to this message"
            title="Reply"
          >
            <Reply className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------
 * Template dialog
 * ---------------------------------------------------------------------------------------------- */

function TemplateDialog({
  open,
  onOpenChange,
  waId,
  customerName,
  onSent,
  onSessionExpired,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  waId: string | null
  customerName?: string
  onSent: (message: ChatMessage) => void
  onSessionExpired: () => void
}) {
  const [templates, setTemplates] = useState<InboxTemplate[]>([])
  const [configured, setConfigured] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState("")
  const [headerValues, setHeaderValues] = useState<string[]>([])
  const [bodyValues, setBodyValues] = useState<string[]>([])
  const [manualName, setManualName] = useState("")
  const [manualLanguage, setManualLanguage] = useState("en")
  const [manualParams, setManualParams] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true)
      setLoadError("")
      try {
        const data = await fetch(`/api/admin/whatsapp/templates${refresh ? "?refresh=1" : ""}`, {
          credentials: "include",
          cache: "no-store",
        })
        if (data.status === 401) return onSessionExpired()
        const json = await data.json()
        setConfigured(json.configured !== false)
        setTemplates(json.templates || [])
        if (!json.success && json.configured !== false) setLoadError(json.message || "Could not load templates")
      } catch {
        setLoadError("Could not load templates")
      } finally {
        setLoading(false)
      }
    },
    [onSessionExpired],
  )

  useEffect(() => {
    if (open) {
      setError("")
      if (!templates.length) load()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = templates.find((t) => `${t.name}|${t.language}` === selectedKey) || null

  useEffect(() => {
    if (!selected) return
    const firstValue = (variable: string, index: number) =>
      index === 0 && customerName && (variable === "1" || /name/i.test(variable)) ? customerName : ""
    setHeaderValues(selected.headerVariables.map(() => ""))
    setBodyValues(selected.bodyVariables.map(firstValue))
  }, [selectedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const previewText = useMemo(() => {
    if (!selected) return ""
    return [
      selected.headerText ? fillTemplate(selected.headerText, selected.headerVariables, headerValues) : "",
      fillTemplate(selected.bodyText, selected.bodyVariables, bodyValues),
      selected.footerText || "",
    ]
      .filter(Boolean)
      .join("\n\n")
  }, [selected, headerValues, bodyValues])

  const send = async () => {
    if (!waId) return
    setSending(true)
    setError("")
    try {
      const payload = configured
        ? {
            type: "template",
            waId,
            name: selected?.name,
            language: selected?.language,
            parameterFormat: selected?.parameterFormat,
            headerParams: headerValues,
            headerParamNames: selected?.headerVariables,
            bodyParams: bodyValues,
            bodyParamNames: selected?.bodyVariables,
            previewText,
          }
        : {
            type: "template",
            waId,
            name: manualName.trim(),
            language: manualLanguage.trim() || "en",
            bodyParams: manualParams,
            previewText: `Template: ${manualName.trim()}${manualParams.length ? ` (${manualParams.join(", ")})` : ""}`,
          }
      const data = await api<{ message: ChatMessage }>("/api/admin/whatsapp/send", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      onSent(data.message)
      onOpenChange(false)
      setSelectedKey("")
      setManualParams([])
    } catch (e) {
      if (e instanceof SessionExpiredError) return onSessionExpired()
      setError(e instanceof Error ? e.message : "Failed to send template")
    } finally {
      setSending(false)
    }
  }

  const canSend = configured
    ? Boolean(selected?.supported) && [...headerValues, ...bodyValues].every((v) => v.trim())
    : Boolean(manualName.trim()) && manualParams.every((v) => v.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#8B5A3C]" /> Send approved template
          </DialogTitle>
          <DialogDescription>
            Templates can be sent at any time, including after the 24-hour reply window has closed. Meta charges per
            delivered template based on its category.
          </DialogDescription>
        </DialogHeader>

        {configured ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="h-10 flex-1 rounded-md border border-[#D9CFC7] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5A3C]/40"
                disabled={loading}
              >
                <option value="">{loading ? "Loading templates…" : "Choose a template"}</option>
                {templates.map((t) => (
                  <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`} disabled={!t.supported}>
                    {t.name} ({t.language}) · {t.category.toLowerCase()}
                    {!t.supported ? ` — not supported here: ${t.unsupportedReason}` : ""}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="icon" onClick={() => load(true)} disabled={loading} title="Refresh templates">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            {loadError && <p className="text-sm text-red-600">{loadError}</p>}
            {!loading && !loadError && templates.length === 0 && (
              <p className="text-sm text-[#8a7a6d]">No approved templates found in your WhatsApp Business Account.</p>
            )}

            {selected && (
              <>
                {[...selected.headerVariables.map((v, i) => ({ v, i, part: "header" as const })),
                  ...selected.bodyVariables.map((v, i) => ({ v, i, part: "body" as const }))].map(({ v, i, part }) => (
                  <label key={`${part}-${v}`} className="block">
                    <span className="mb-1 block text-xs font-medium text-[#5c4a3d]">
                      {part === "header" ? "Header" : "Body"} variable {`{{${v}}}`}
                    </span>
                    <Input
                      value={(part === "header" ? headerValues : bodyValues)[i] || ""}
                      onChange={(e) => {
                        const setter = part === "header" ? setHeaderValues : setBodyValues
                        setter((prev) => prev.map((val, idx) => (idx === i ? e.target.value : val)))
                      }}
                      placeholder={`Value for {{${v}}}`}
                    />
                  </label>
                ))}

                <div>
                  <span className="mb-1 block text-xs font-medium text-[#5c4a3d]">Preview</span>
                  <div className="rounded-xl bg-[#EFE7DF] p-3">
                    <div className="ml-auto max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-[#F3E3D3] px-3 py-2 text-sm shadow-sm">
                      {previewText}
                      {selected.buttons.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-black/10 pt-2 text-center text-[#8B5A3C]">
                          {selected.buttons.map((b) => (
                            <div key={b}>{b}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              Add <code className="font-mono">META_WHATSAPP_BUSINESS_ACCOUNT_ID</code> to your environment to pick
              templates from a list. Until then, type the exact approved template name.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-2 block">
                <span className="mb-1 block text-xs font-medium text-[#5c4a3d]">Template name</span>
                <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. order_status_update" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#5c4a3d]">Language</span>
                <Input value={manualLanguage} onChange={(e) => setManualLanguage(e.target.value)} placeholder="en" />
              </label>
            </div>
            {manualParams.map((value, i) => (
              <div key={i} className="flex items-end gap-2">
                <label className="block flex-1">
                  <span className="mb-1 block text-xs font-medium text-[#5c4a3d]">Body variable {`{{${i + 1}}}`}</span>
                  <Input
                    value={value}
                    onChange={(e) => setManualParams((p) => p.map((v, idx) => (idx === i ? e.target.value : v)))}
                  />
                </label>
                <Button variant="ghost" size="icon" onClick={() => setManualParams((p) => p.filter((_, idx) => idx !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setManualParams((p) => [...p, ""])}>
              + Add variable
            </Button>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={send} disabled={!canSend || sending || !waId} className="bg-[#8B5A3C] text-white hover:bg-[#754A30]">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------------------------------- */

export default function WhatsAppInboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [totalUnread, setTotalUnread] = useState(0)

  const [activeWaId, setActiveWaId] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const [draft, setDraft] = useState("")
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [sendError, setSendError] = useState("")
  const [templateOpen, setTemplateOpen] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatNumber, setNewChatNumber] = useState("")
  const [sessionExpired, setSessionExpired] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)
  const preserveScroll = useRef<number | null>(null)
  const activeRef = useRef<string | null>(null)
  activeRef.current = activeWaId

  const handleSessionExpired = useCallback(() => setSessionExpired(true), [])

  // Countdown refresh for the 24h window badges
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  /* ---------- conversation list ---------- */
  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ filter })
      if (debouncedSearch) params.set("q", debouncedSearch)
      const data = await api<{ conversations: Conversation[]; totalUnread: number }>(
        `/api/admin/whatsapp/conversations?${params}`,
      )
      setConversations(data.conversations)
      setTotalUnread(data.totalUnread)
    } catch (e) {
      if (e instanceof SessionExpiredError) setSessionExpired(true)
    } finally {
      setListLoading(false)
    }
  }, [filter, debouncedSearch])

  useEffect(() => {
    if (sessionExpired) return
    loadConversations()
    const t = setInterval(() => {
      if (!document.hidden) loadConversations()
    }, LIST_POLL_MS)
    return () => clearInterval(t)
  }, [loadConversations, sessionExpired])

  /* ---------- thread ---------- */
  const markRead = useCallback(async (waId: string) => {
    setConversations((prev) => prev.map((c) => (c.waId === waId ? { ...c, unreadCount: 0 } : c)))
    try {
      await api(`/api/admin/whatsapp/conversations/${waId}`, { method: "PATCH" })
    } catch (e) {
      if (e instanceof SessionExpiredError) setSessionExpired(true)
    }
  }, [])

  const loadThread = useCallback(
    async (waId: string, initial = false) => {
      if (initial) setThreadLoading(true)
      try {
        const data = await api<{ conversation: Conversation; messages: ChatMessage[]; hasMore: boolean }>(
          `/api/admin/whatsapp/conversations/${waId}`,
        )
        if (activeRef.current !== waId) return
        setActiveConversation(data.conversation)
        setMessages((prev) => (initial ? data.messages : mergeMessages(prev, data.messages)))
        if (initial) setHasMore(data.hasMore)
        if (data.conversation.unreadCount > 0 && !document.hidden) markRead(waId)
      } catch (e) {
        if (e instanceof SessionExpiredError) setSessionExpired(true)
      } finally {
        if (initial) setThreadLoading(false)
      }
    },
    [markRead],
  )

  useEffect(() => {
    if (!activeWaId || sessionExpired) return
    stickToBottom.current = true
    setMessages([])
    setReplyTo(null)
    setSendError("")
    loadThread(activeWaId, true)
    const t = setInterval(() => {
      if (!document.hidden) loadThread(activeWaId)
    }, THREAD_POLL_MS)
    return () => clearInterval(t)
  }, [activeWaId, loadThread, sessionExpired])

  const loadOlder = async () => {
    if (!activeWaId || !messages.length || loadingOlder) return
    setLoadingOlder(true)
    try {
      const oldest = messages.find((m) => !m.pending)?.timestamp
      const data = await api<{ messages: ChatMessage[]; hasMore: boolean }>(
        `/api/admin/whatsapp/conversations/${activeWaId}?before=${encodeURIComponent(oldest || "")}`,
      )
      preserveScroll.current = scrollRef.current ? scrollRef.current.scrollHeight - scrollRef.current.scrollTop : null
      setMessages((prev) => mergeMessages(prev, data.messages))
      setHasMore(data.hasMore)
    } catch (e) {
      if (e instanceof SessionExpiredError) setSessionExpired(true)
    } finally {
      setLoadingOlder(false)
    }
  }

  // Scroll management: stick to bottom for new messages, keep position when loading older ones.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (preserveScroll.current != null) {
      el.scrollTop = el.scrollHeight - preserveScroll.current
      preserveScroll.current = null
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  /* ---------- sending ---------- */
  const appendSent = useCallback((message: ChatMessage) => {
    stickToBottom.current = true
    setMessages((prev) => mergeMessages(prev.filter((m) => !m.pending), [message]))
    setConversations((prev) => {
      const existing = prev.find((c) => c.waId === message.waId)
      const updated: Conversation = {
        ...(existing || { waId: message.waId, unreadCount: 0, windowOpen: false }),
        lastMessageAt: message.timestamp,
        lastMessageText: message.text,
        lastMessageDirection: "outbound",
        lastMessageStatus: message.status,
      }
      return [updated, ...prev.filter((c) => c.waId !== message.waId)]
    })
  }, [])

  const sendText = async () => {
    const text = draft.trim()
    if (!text || !activeWaId) return
    setSendError("")

    const temp: ChatMessage = {
      _id: `temp-${Date.now()}`,
      wamid: "",
      waId: activeWaId,
      direction: "outbound",
      type: "text",
      text,
      status: "accepted",
      timestamp: new Date().toISOString(),
      contextWamid: replyTo?.wamid || null,
      pending: true,
    }
    stickToBottom.current = true
    setMessages((prev) => [...prev, temp])
    setDraft("")
    const context = replyTo?.wamid || null
    setReplyTo(null)

    try {
      const data = await api<{ message: ChatMessage }>("/api/admin/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({ type: "text", waId: activeWaId, text, contextWamid: context }),
      })
      appendSent(data.message)
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m._id !== temp._id))
      setDraft(text) // give the text back so nothing is lost
      if (e instanceof SessionExpiredError) return setSessionExpired(true)
      const err = e as Error & { code?: string }
      setSendError(err.message)
      if (err.code === "WINDOW_CLOSED" || err.code === "131047") {
        setActiveConversation((c) => (c ? { ...c, windowOpen: false } : c))
      }
    } finally {
      textareaRef.current?.focus()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendText()
    }
  }

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [draft])

  const startNewChat = () => {
    const digits = newChatNumber.replace(/\D/g, "")
    const waId = digits.length === 10 ? `91${digits}` : digits
    if (waId.length < 10 || waId.length > 15) return
    setNewChatOpen(false)
    setNewChatNumber("")
    setActiveWaId(waId)
    setTemplateOpen(true)
  }

  /* ---------- derived ---------- */
  const messagesByWamid = useMemo(() => new Map(messages.map((m) => [m.wamid, m])), [messages])
  const windowOpenNow = windowRemaining(activeConversation?.lastInboundAt, now) > 0
  const activeName = activeConversation ? displayName(activeConversation) : activeWaId ? formatPhone(activeWaId) : ""

  /* ---------- render ---------- */
  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      {sessionExpired && (
        <div className="flex items-center justify-between gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          <span>Your admin session has expired, so the inbox has stopped updating.</span>
          <Link href="/admin" className="font-semibold underline">
            Log in again
          </Link>
        </div>
      )}

      <div className="flex h-[calc(100dvh-5rem)] min-h-[520px] overflow-hidden bg-white">
        {/* ================= Conversation list ================= */}
        <section
          className={`${activeWaId ? "hidden lg:flex" : "flex"} w-full lg:w-[380px] shrink-0 flex-col border-r border-[#E5D5C5] bg-white`}
        >
          <div className="border-b border-[#EFE5DC] px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-[#2b211b] flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" /> WhatsApp Inbox
                </h1>
                <p className="text-xs text-[#8a7a6d]">
                  {totalUnread > 0 ? `${totalUnread} unread message${totalUnread === 1 ? "" : "s"}` : "All caught up"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#8B5A3C] hover:bg-[#8B5A3C]/10"
                onClick={() => setNewChatOpen(true)}
                title="Message a new number"
              >
                <MessageSquarePlus className="h-5 w-5" />
              </Button>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89889]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or number"
                className="h-9 rounded-full border-0 bg-[#F5F1ED] pl-9 focus-visible:ring-[#8B5A3C]/30"
              />
            </div>

            <div className="mt-3 flex gap-2">
              {(["all", "unread", "open"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === f ? "bg-[#8B5A3C] text-white" : "bg-[#F5F1ED] text-[#5c4a3d] hover:bg-[#EADBCD]"
                  }`}
                >
                  {f === "all" ? "All" : f === "unread" ? "Unread" : "Reply window open"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="space-y-1 p-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                    <div className="h-11 w-11 animate-pulse rounded-full bg-[#EFE5DC]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/2 animate-pulse rounded bg-[#EFE5DC]" />
                      <div className="h-3 w-3/4 animate-pulse rounded bg-[#F5F1ED]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[#8a7a6d]">
                <MessageCircle className="mb-3 h-10 w-10 text-[#D9CFC7]" />
                <p className="font-medium text-[#5c4a3d]">{debouncedSearch || filter !== "all" ? "No matches" : "No conversations yet"}</p>
                <p className="mt-1 text-sm">
                  {debouncedSearch || filter !== "all"
                    ? "Try a different search or filter."
                    : "Messages customers send to your WhatsApp Business number will appear here."}
                </p>
              </div>
            ) : (
              <ul>
                {conversations.map((c) => {
                  const name = displayName(c)
                  const active = c.waId === activeWaId
                  const open = windowRemaining(c.lastInboundAt, now) > 0
                  return (
                    <li key={c.waId}>
                      <button
                        type="button"
                        onClick={() => setActiveWaId(c.waId)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                          active ? "bg-[#F3E3D3]" : "hover:bg-[#FAF6F2]"
                        }`}
                      >
                        <div className="relative">
                          <Avatar name={name} seed={c.waId} />
                          {open && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#25D366]"
                              title="Reply window open"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 border-b border-[#F3ECE5] pb-3 -mb-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={`truncate text-[15px] ${c.unreadCount ? "font-semibold text-[#2b211b]" : "font-medium text-[#3d3028]"}`}>
                              {name}
                            </span>
                            <span className={`shrink-0 text-xs ${c.unreadCount ? "font-semibold text-[#1FA855]" : "text-[#a89889]"}`}>
                              {listTime(c.lastMessageAt)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1 text-sm text-[#8a7a6d]">
                              {c.lastMessageDirection === "outbound" && <StatusTicks status={c.lastMessageStatus} />}
                              <span className="truncate">{c.lastMessageText || "—"}</span>
                            </span>
                            {c.unreadCount > 0 && (
                              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25D366] px-1.5 text-[11px] font-bold text-white">
                                {c.unreadCount > 99 ? "99+" : c.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ================= Thread ================= */}
        <section className={`${activeWaId ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col`}>
          {!activeWaId ? (
            <div className="flex flex-1 flex-col items-center justify-center bg-[#F5F1ED] p-8 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
                <MessageCircle className="h-10 w-10 text-[#8B5A3C]" />
              </div>
              <h2 className="text-xl font-semibold text-[#2b211b]">Reply to your customers on WhatsApp</h2>
              <p className="mt-2 max-w-md text-sm text-[#8a7a6d]">
                Pick a conversation to reply. You can send free-form messages for 24 hours after a customer&apos;s last
                message. After that, WhatsApp only allows approved templates.
              </p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <header className="flex items-center gap-3 border-b border-[#E5D5C5] bg-white px-3 py-2.5 sm:px-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setActiveWaId(null)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar name={activeName} seed={activeWaId} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-[#2b211b]">{activeName}</div>
                  <div className="truncate text-xs text-[#8a7a6d]">{formatPhone(activeWaId)}</div>
                </div>
                <div className="hidden sm:block">
                  <WindowBadge lastInboundAt={activeConversation?.lastInboundAt} now={now} />
                </div>
              </header>
              <div className="border-b border-[#EFE5DC] bg-white px-4 py-1.5 sm:hidden">
                <WindowBadge lastInboundAt={activeConversation?.lastInboundAt} now={now} />
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                onScroll={onScroll}
                className="flex-1 overflow-y-auto py-4"
                style={{
                  backgroundColor: "#F5F1ED",
                  backgroundImage: "radial-gradient(rgba(139,90,60,0.07) 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
              >
                {threadLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-[#8B5A3C]" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {hasMore && (
                      <div className="flex justify-center pb-2">
                        <Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder} className="rounded-full bg-white text-xs">
                          {loadingOlder ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Load older messages
                        </Button>
                      </div>
                    )}
                    {messages.length === 0 && (
                      <div className="mx-auto mt-10 max-w-sm rounded-xl bg-white/80 p-4 text-center text-sm text-[#5c4a3d] shadow-sm">
                        No messages with this number yet. Start the conversation with an approved template.
                      </div>
                    )}
                    {messages.map((m, i) => {
                      const showDay = i === 0 || !sameDay(new Date(messages[i - 1].timestamp), new Date(m.timestamp))
                      return (
                        <div key={m._id}>
                          {showDay && (
                            <div className="my-3 flex justify-center">
                              <span className="rounded-lg bg-white/90 px-3 py-1 text-xs font-medium text-[#5c4a3d] shadow-sm">
                                {dayLabel(m.timestamp)}
                              </span>
                            </div>
                          )}
                          <MessageBubble
                            m={m}
                            quoted={m.contextWamid ? messagesByWamid.get(m.contextWamid) : undefined}
                            onReply={(msg) => {
                              setReplyTo(msg)
                              textareaRef.current?.focus()
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Composer */}
              <footer className="border-t border-[#E5D5C5] bg-[#FAF6F2] px-3 py-3 sm:px-4">
                {sendError && (
                  <div className="mb-2 flex items-start justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    <span className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {sendError}
                    </span>
                    <button type="button" onClick={() => setSendError("")} aria-label="Dismiss">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {windowOpenNow ? (
                  <>
                    {replyTo && (
                      <div className="mb-2 flex items-start justify-between gap-2 rounded-lg border-l-4 border-[#8B5A3C] bg-white px-3 py-2">
                        <div className="min-w-0 text-sm">
                          <div className="text-xs font-semibold text-[#8B5A3C]">
                            Replying to {replyTo.direction === "outbound" ? "yourself" : activeName}
                          </div>
                          <div className="truncate text-[#5c4a3d]">{messagePreview(replyTo)}</div>
                        </div>
                        <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                          <X className="h-4 w-4 text-[#8a7a6d]" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-[#8B5A3C] hover:bg-[#8B5A3C]/10"
                        onClick={() => setTemplateOpen(true)}
                        title="Send a template"
                      >
                        <Sparkles className="h-5 w-5" />
                      </Button>
                      <div className="relative flex-1">
                        <Textarea
                          ref={textareaRef}
                          value={draft}
                          onChange={(e) => setDraft(e.target.value.slice(0, MAX_TEXT))}
                          onKeyDown={onKeyDown}
                          rows={1}
                          placeholder="Type a reply…"
                          title="Enter to send · Shift+Enter for a new line"
                          disabled={sessionExpired}
                          className="min-h-[44px] max-h-40 resize-none rounded-2xl border-[#E5D5C5] bg-white py-2.5 pr-14 text-[15px] focus-visible:ring-[#8B5A3C]/30"
                        />
                        {draft.length > MAX_TEXT - 300 && (
                          <span className="absolute bottom-2 right-3 text-[10px] text-[#a89889]">
                            {draft.length}/{MAX_TEXT}
                          </span>
                        )}
                      </div>
                      <Button
                        size="icon"
                        onClick={sendText}
                        disabled={!draft.trim() || sessionExpired}
                        className="h-11 w-11 shrink-0 rounded-full bg-[#8B5A3C] text-white hover:bg-[#754A30] disabled:opacity-40"
                        aria-label="Send"
                      >
                        <Send className="h-5 w-5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 sm:flex-row">
                    <p className="text-sm text-[#5c4a3d]">
                      {activeConversation?.lastInboundAt
                        ? "It's been more than 24 hours since this customer's last message. WhatsApp only allows an approved template now. Free replies reopen once they respond."
                        : "This customer hasn't messaged you yet. Start the conversation with an approved template."}
                    </p>
                    <Button
                      onClick={() => setTemplateOpen(true)}
                      disabled={sessionExpired}
                      className="shrink-0 bg-[#8B5A3C] text-white hover:bg-[#754A30]"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Send template
                    </Button>
                  </div>
                )}
              </footer>
            </>
          )}
        </section>
      </div>

      <TemplateDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        waId={activeWaId}
        customerName={activeConversation?.profileName || undefined}
        onSent={appendSent}
        onSessionExpired={handleSessionExpired}
      />

      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Message a new number</DialogTitle>
            <DialogDescription>
              WhatsApp requires an approved template for the first message to a customer. Enter the number with country
              code. A 10-digit number is treated as Indian (+91).
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newChatNumber}
            onChange={(e) => setNewChatNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startNewChat()}
            placeholder="+91 98765 43210"
            inputMode="tel"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNewChatOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={startNewChat}
              disabled={(() => {
                const d = newChatNumber.replace(/\D/g, "")
                const len = d.length === 10 ? 12 : d.length
                return len < 11 || len > 15
              })()}
              className="bg-[#8B5A3C] text-white hover:bg-[#754A30]"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
