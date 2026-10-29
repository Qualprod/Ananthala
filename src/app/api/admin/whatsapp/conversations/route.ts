import { type NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import { getAdminFromRequest, isWindowOpen } from "@/lib/whatsapp-inbox"
import WhatsAppConversation from "@/models/WhatsAppConversation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// GET /api/admin/whatsapp/conversations?q=&filter=all|unread|open&limit=
export async function GET(request: NextRequest) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    await connectDB()
    const url = new URL(request.url)
    const q = url.searchParams.get("q")?.trim() || ""
    const filter = url.searchParams.get("filter") || "all"
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 300)

    const query: Record<string, unknown> = {}
    if (q) {
      const digits = q.replace(/\D/g, "")
      query.$or = [
        { profileName: { $regex: escapeRegex(q), $options: "i" } },
        ...(digits ? [{ waId: { $regex: escapeRegex(digits) } }] : []),
      ]
    }
    if (filter === "unread") query.unreadCount = { $gt: 0 }
    if (filter === "open") query.lastInboundAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }

    const [conversations, totalUnread] = await Promise.all([
      WhatsAppConversation.find(query).sort({ lastMessageAt: -1 }).limit(limit).lean(),
      WhatsAppConversation.aggregate([{ $group: { _id: null, total: { $sum: "$unreadCount" } } }]),
    ])

    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
      totalUnread: totalUnread[0]?.total || 0,
      conversations: conversations.map((c) => ({ ...c, windowOpen: isWindowOpen(c.lastInboundAt) })),
    })
  } catch (error) {
    console.error("WhatsApp inbox: list conversations failed", error)
    return NextResponse.json({ success: false, message: "Failed to load conversations" }, { status: 500 })
  }
}
