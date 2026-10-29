import { type NextRequest, NextResponse } from "next/server"
import { getAdminFromRequest, sendTemplateMessage, sendTextReply } from "@/lib/whatsapp-inbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const asStringArray = (value: unknown) => (Array.isArray(value) ? value.map((v) => String(v ?? "")) : [])

// POST /api/admin/whatsapp/send
//   { type: "text", waId, text, contextWamid? }
//   { type: "template", waId, name, language, headerParams?, bodyParams?, parameterFormat?, headerParamNames?, bodyParamNames?, previewText? }
export async function POST(request: NextRequest) {
  const admin = getAdminFromRequest(request)
  if (!admin) {
    return NextResponse.json({ success: false, message: "Your admin session has expired. Please log in again." }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request" }, { status: 400 })
  }

  try {
    const outcome =
      body?.type === "template"
        ? await sendTemplateMessage({
            waId: String(body.waId || ""),
            name: String(body.name || ""),
            language: String(body.language || "en"),
            headerParams: asStringArray(body.headerParams),
            bodyParams: asStringArray(body.bodyParams),
            parameterFormat: body.parameterFormat === "NAMED" ? "NAMED" : "POSITIONAL",
            headerParamNames: asStringArray(body.headerParamNames),
            bodyParamNames: asStringArray(body.bodyParamNames),
            previewText: typeof body.previewText === "string" ? body.previewText.slice(0, 4096) : undefined,
            admin,
          })
        : await sendTextReply({
            waId: String(body?.waId || ""),
            text: String(body?.text || ""),
            contextWamid: typeof body?.contextWamid === "string" ? body.contextWamid : null,
            admin,
          })

    if (!outcome.ok) {
      return NextResponse.json(
        { success: false, code: outcome.code, message: outcome.message },
        { status: outcome.status >= 400 && outcome.status < 600 ? outcome.status : 502 },
      )
    }
    return NextResponse.json({ success: true, message: outcome.message })
  } catch (error) {
    console.error("WhatsApp inbox: send failed", error)
    return NextResponse.json({ success: false, message: "Failed to send message" }, { status: 500 })
  }
}
