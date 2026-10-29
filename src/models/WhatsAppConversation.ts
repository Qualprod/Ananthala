import mongoose, { Schema, models, type Model } from "mongoose"

/**
 * One document per WhatsApp customer (identified by their WhatsApp ID = phone digits with country code).
 * Used by the admin WhatsApp inbox (/admin/whatsapp).
 */
export interface IWhatsAppConversation {
  waId: string
  profileName?: string
  lastInboundAt?: Date | null
  lastInboundWamid?: string | null
  lastMessageAt?: Date | null
  lastMessageText?: string
  lastMessageDirection?: "inbound" | "outbound"
  lastMessageStatus?: string
  unreadCount: number
  createdAt: Date
  updatedAt: Date
}

const WhatsAppConversationSchema = new Schema<IWhatsAppConversation>(
  {
    waId: { type: String, required: true, unique: true, index: true, trim: true },
    profileName: { type: String, default: "", trim: true },
    lastInboundAt: { type: Date, default: null },
    lastInboundWamid: { type: String, default: null },
    lastMessageAt: { type: Date, default: null, index: true },
    lastMessageText: { type: String, default: "" },
    lastMessageDirection: { type: String, enum: ["inbound", "outbound"], default: "inbound" },
    lastMessageStatus: { type: String, default: "" },
    unreadCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

WhatsAppConversationSchema.index({ lastMessageAt: -1 })

const WhatsAppConversation: Model<IWhatsAppConversation> =
  (models.WhatsAppConversation as Model<IWhatsAppConversation>) ||
  mongoose.model<IWhatsAppConversation>("WhatsAppConversation", WhatsAppConversationSchema)

export default WhatsAppConversation
