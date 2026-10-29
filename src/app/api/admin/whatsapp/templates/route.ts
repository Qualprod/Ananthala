import { type NextRequest, NextResponse } from "next/server"
import { getAdminFromRequest, listApprovedTemplates } from "@/lib/whatsapp-inbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/admin/whatsapp/templates?refresh=1  → approved templates from your WhatsApp Business Account
export async function GET(request: NextRequest) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }
  const refresh = new URL(request.url).searchParams.get("refresh") === "1"
  const result = await listApprovedTemplates(refresh)
  if (!result.ok) {
    return NextResponse.json({ success: false, configured: result.configured, message: result.message, templates: [] })
  }
  return NextResponse.json({ success: true, configured: true, templates: result.templates })
}
