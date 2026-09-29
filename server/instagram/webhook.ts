import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

import type { MessagingEvent } from "../analytics/dm"

/**
 * Verifies X-Hub-Signature-256 ("sha256=<hex>") against the raw request bytes
 * with the Instagram app secret, in constant time. The HMAC must be computed
 * over the exact bytes Meta sent, so callers pass the unparsed body.
 */
export function verifyWebhookSignature(
  rawBody: Uint8Array,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header || !appSecret) return false
  const match = /^sha256=([0-9a-fA-F]{64})$/.exec(header.trim())
  if (!match?.[1]) return false
  const expected = createHmac("sha256", appSecret).update(rawBody).digest()
  const received = Buffer.from(match[1], "hex")
  return received.length === expected.length && timingSafeEqual(received, expected)
}

type SourceReviver = (key: string, value: unknown, context?: { source?: string }) => unknown
const parseWithSource = JSON.parse as (text: string, reviver: SourceReviver) => unknown

/**
 * Instagram IDs are 17+ digit integers, past what a JavaScript number holds
 * exactly (2^53). If Meta ever sends one as a JSON number, a plain JSON.parse
 * silently rounds it and the comment is routed to the wrong account or none.
 * This reads such numbers from their original source digits instead, using
 * JSON.parse source text access (Node 21+). Throws on invalid JSON.
 */
export function parseWebhookJson(text: string): unknown {
  return parseWithSource(text, (_key, value, context) => {
    if (
      typeof value === "number" &&
      !Number.isSafeInteger(value) &&
      context?.source &&
      /^-?\d+$/.test(context.source)
    ) {
      return context.source
    }
    return value
  })
}

export interface ParsedComment {
  /** The connected professional account the comment belongs to (entry.id). */
  igUserId: string
  commentId: string
  commenterId: string | null
  commenterUsername: string | null
  text: string
  mediaId: string | null
  mediaProductType: string | null
  parentId: string | null
}

const CommentValue = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  comment_id: z.union([z.string(), z.number()]).optional(),
  text: z.string().optional(),
  parent_id: z.union([z.string(), z.number()]).optional(),
  from: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      username: z.string().optional(),
    })
    .optional(),
  media: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      media_product_type: z.string().optional(),
    })
    .optional(),
})

const Change = z.object({ field: z.string(), value: z.unknown() })

const Entry = z.object({
  id: z.union([z.string(), z.number()]),
  time: z.number().optional(),
  // Instagram Login deliveries: field and value directly on the entry.
  field: z.string().optional(),
  value: z.unknown().optional(),
  // Facebook Login style: a changes array.
  changes: z.array(Change).optional(),
})

const Payload = z.object({
  object: z.string(),
  entry: z.array(z.unknown()),
})

const str = (v: string | number | undefined): string | null =>
  v === undefined || v === "" ? null : String(v)

/**
 * Extracts comment events from a webhook payload. Accepts both documented
 * shapes (entry.field/value and entry.changes[]). Other fields and malformed
 * entries are skipped individually, so one bad entry never drops the batch.
 */
export function parseCommentEvents(body: unknown): ParsedComment[] {
  const payload = Payload.safeParse(body)
  if (!payload.success || payload.data.object !== "instagram") return []

  const out: ParsedComment[] = []
  for (const rawEntry of payload.data.entry) {
    const entry = Entry.safeParse(rawEntry)
    if (!entry.success) continue

    const changes = entry.data.changes ?? (
      entry.data.field ? [{ field: entry.data.field, value: entry.data.value }] : []
    )

    for (const change of changes) {
      if (change.field !== "comments") continue
      const value = CommentValue.safeParse(change.value)
      if (!value.success) continue
      const v = value.data
      const commentId = str(v.id) ?? str(v.comment_id)
      if (!commentId) continue

      out.push({
        igUserId: String(entry.data.id),
        commentId,
        commenterId: str(v.from?.id),
        commenterUsername: v.from?.username ?? null,
        text: v.text ?? "",
        mediaId: str(v.media?.id),
        mediaProductType: v.media?.media_product_type ?? null,
        parentId: str(v.parent_id),
      })
    }
  }
  return out
}

// -------------------------------------------------------------- messaging

const MessagingValue = z.object({
  sender: z.object({ id: z.union([z.string(), z.number()]).optional() }).partial().optional(),
  recipient: z.object({ id: z.union([z.string(), z.number()]).optional() }).partial().optional(),
  timestamp: z.union([z.number(), z.string()]).optional(),
  message: z
    .object({
      is_echo: z.boolean().optional(),
      is_deleted: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
})

const MessagingEntry = z.object({
  id: z.union([z.string(), z.number()]),
  messaging: z.array(z.unknown()).optional(),
  field: z.string().optional(),
  value: z.unknown().optional(),
  changes: z.array(Change).optional(),
})

/** Meta sends seconds in some Instagram examples and milliseconds in others. */
function toMs(ts: number | string | undefined): number | null {
  if (ts === undefined) return null
  const n = typeof ts === "string" ? Number(ts) : ts
  if (!Number.isFinite(n) || n <= 0) return null
  return n < 1e12 ? n * 1000 : n
}

/**
 * Extracts messaging events: entry.messaging[] (the documented shape) and a
 * "messages" field in entry.field/value or entry.changes[]. Only metadata is
 * kept. Message text and attachments are never copied out of the payload.
 */
export function parseMessagingEvents(body: unknown): MessagingEvent[] {
  const payload = Payload.safeParse(body)
  if (!payload.success || payload.data.object !== "instagram") return []

  const out: MessagingEvent[] = []
  for (const rawEntry of payload.data.entry) {
    const entry = MessagingEntry.safeParse(rawEntry)
    if (!entry.success) continue
    const igUserId = String(entry.data.id)

    const values: unknown[] = [...(entry.data.messaging ?? [])]
    if (entry.data.field === "messages") values.push(entry.data.value)
    for (const change of entry.data.changes ?? []) {
      if (change.field === "messages") values.push(change.value)
    }

    for (const raw of values) {
      const v = MessagingValue.safeParse(raw)
      if (!v.success) continue
      out.push({
        igUserId,
        senderId: str(v.data.sender?.id),
        recipientId: str(v.data.recipient?.id),
        timestampMs: toMs(v.data.timestamp),
        hasMessage: v.data.message !== undefined,
        isEcho: v.data.message?.is_echo === true,
        isDeleted: v.data.message?.is_deleted === true,
      })
    }
  }
  return out
}
