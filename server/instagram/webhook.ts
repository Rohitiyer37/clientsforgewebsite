import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"

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
