import mongoose, { Schema, models, type Model } from "mongoose"

/**
 * Every inbound and outbound WhatsApp message shown in the admin inbox.
 * `wamid` is Meta's message id and is unique, so webhook retries never create duplicates.
 */
export type WhatsAppMessageStatus = "accepted" | "sent" | "delivered" | "read" | "failed" | "received"

export const STATUS_RANK: Record<string, number> = {
  accepted: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
}

export interface IWhatsAppMessage {
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
  status: WhatsAppMessageStatus
  statusRank: number
  error?: { code?: number; title?: string; message?: string } | null
  sentBy?: { id?: string; name?: string; email?: string } | null
  timestamp: Date
  createdAt: Date
  updatedAt: Date
}

const WhatsAppMessageSchema = new Schema<IWhatsAppMessage>(
  {
    wamid: { type: String, required: true, unique: true },
    waId: { type: String, required: true, index: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    type: { type: String, default: "text" },
    text: { type: String, default: "" },
    caption: { type: String, default: "" },
    media: {
      type: { id: String, mimeType: String, filename: String, voice: Boolean },
      default: null,
      _id: false,
    },
    location: {
      type: { latitude: Number, longitude: Number, name: String, address: String },
      default: null,
      _id: false,
    },
    template: { type: { name: String, language: String }, default: null, _id: false },
    contextWamid: { type: String, default: null },
    reaction: { type: String, default: null },
    status: { type: String, default: "received" },
    statusRank: { type: Number, default: 0 },
    error: { type: { code: Number, title: String, message: String }, default: null, _id: false },
    sentBy: { type: { id: String, name: String, email: String }, default: null, _id: false },
    timestamp: { type: Date, required: true },
  },
  { timestamps: true },
)

WhatsAppMessageSchema.index({ waId: 1, timestamp: -1 })

const WhatsAppMessage: Model<IWhatsAppMessage> =
  (models.WhatsAppMessage as Model<IWhatsAppMessage>) ||
  mongoose.model<IWhatsAppMessage>("WhatsAppMessage", WhatsAppMessageSchema)

export default WhatsAppMessage
