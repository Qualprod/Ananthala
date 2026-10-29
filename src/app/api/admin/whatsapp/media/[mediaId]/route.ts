import { type NextRequest, NextResponse } from "next/server"
import { downloadMedia, getAdminFromRequest } from "@/lib/whatsapp-inbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/admin/whatsapp/media/:mediaId  → streams customer media (photos, voice notes, documents)
export async function GET(request: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  const { mediaId } = await params
  if (!/^\d{5,30}$/.test(mediaId)) {
    return NextResponse.json({ success: false, message: "Invalid media id" }, { status: 400 })
  }

  const media = await downloadMedia(mediaId)
  if (!media) {
    return NextResponse.json({ success: false, message: "Media not available (Meta keeps media for ~30 days)" }, { status: 404 })
  }

  const filename = new URL(request.url).searchParams.get("filename")
  const headers: Record<string, string> = {
    "Content-Type": media.contentType,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  }
  if (media.contentLength) headers["Content-Length"] = media.contentLength
  // Only photos, video and audio are shown inline. Anything else a customer sends (html, svg, pdf…)
  // is forced to download so it can never run inside the admin panel.
  const safeInline = /^(image\/(jpeg|png|webp|gif)|video\/|audio\/)/i.test(media.contentType)
  const encodedName = encodeURIComponent((filename || `whatsapp-${mediaId}`).slice(0, 150))
  headers["Content-Disposition"] = `${safeInline ? "inline" : "attachment"}; filename*=UTF-8''${encodedName}`
  if (!safeInline) headers["Content-Security-Policy"] = "sandbox"

  return new Response(media.body, { status: 200, headers })
}
