import { type NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import { getAdminFromRequest, isWindowOpen, markInboundAsRead } from "@/lib/whatsapp-inbox"
import WhatsAppConversation from "@/models/WhatsAppConversation"
import WhatsAppMessage from "@/models/WhatsAppMessage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

// GET /api/admin/whatsapp/conversations/:waId?before=ISO  → latest messages (oldest first)
export async function GET(request: NextRequest, { params }: { params: Promise<{ waId: string }> }) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { waId: rawWaId } = await params
    const waId = decodeURIComponent(rawWaId).replace(/\D/g, "")
    if (!waId) return NextResponse.json({ success: false, message: "Invalid number" }, { status: 400 })

    await connectDB()
    const url = new URL(request.url)
    const before = url.searchParams.get("before")
    const filter: Record<string, unknown> = { waId }
    if (before && !Number.isNaN(Date.parse(before))) filter.timestamp = { $lt: new Date(before) }

    const [conversation, messages] = await Promise.all([
      WhatsAppConversation.findOne({ waId }).lean(),
      WhatsAppMessage.find(filter).sort({ timestamp: -1, _id: -1 }).limit(PAGE_SIZE + 1).lean(),
    ])

    const hasMore = messages.length > PAGE_SIZE
    const page = messages.slice(0, PAGE_SIZE).reverse()

    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
      conversation: conversation
        ? { ...conversation, windowOpen: isWindowOpen(conversation.lastInboundAt) }
        : { waId, profileName: "", unreadCount: 0, lastInboundAt: null, windowOpen: false },
      messages: page,
      hasMore,
    })
  } catch (error) {
    console.error("WhatsApp inbox: load messages failed", error)
    return NextResponse.json({ success: false, message: "Failed to load messages" }, { status: 500 })
  }
}

// PATCH /api/admin/whatsapp/conversations/:waId  → mark as read (resets unread + sends blue ticks)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ waId: string }> }) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { waId: rawWaId } = await params
    const waId = decodeURIComponent(rawWaId).replace(/\D/g, "")
    await connectDB()

    const conversation = await WhatsAppConversation.findOneAndUpdate(
      { waId, unreadCount: { $gt: 0 } },
      { $set: { unreadCount: 0 } },
    ).lean()

    // Meta marks every earlier message as read too, so one receipt for the latest one is enough.
    // Read receipts are only accepted for recent messages, so skip once the window has closed.
    if (conversation && isWindowOpen(conversation.lastInboundAt)) {
      await markInboundAsRead(conversation.lastInboundWamid)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("WhatsApp inbox: mark read failed", error)
    return NextResponse.json({ success: false, message: "Failed to mark as read" }, { status: 500 })
  }
}
