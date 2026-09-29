import type { Config, Context } from "@netlify/functions"

import { logRecordFailure, recordInboundMessages } from "../../server/analytics/record-dms"
import { processEvents } from "../../server/automations/processor"
import { safeEqual } from "../../server/crypto"
import { db } from "../../server/db"
import { webhookEnv } from "../../server/env"
import { instagramClient } from "../../server/instagram/accounts"
import {
  parseCommentEvents,
  parseMessagingEvents,
  parseWebhookJson,
  verifyWebhookSignature,
} from "../../server/instagram/webhook"
import { log } from "../../server/log"

/** Meta's comment and message payloads are small; anything this large is not from Meta. */
const MAX_BODY_BYTES = 512 * 1024

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}

async function verifySubscription(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token") ?? ""
  const challenge = params.get("hub.challenge") ?? ""
  const { META_WEBHOOK_VERIFY_TOKEN } = webhookEnv()

  if (mode === "subscribe" && safeEqual(token, META_WEBHOOK_VERIFY_TOKEN) && challenge) {
    log.info("webhook_verified")
    return text(challenge, 200)
  }
  log.warn("webhook_verification_rejected", { mode })
  return text("Forbidden", 403)
}

async function receive(req: Request, context: Context): Promise<Response> {
  const { INSTAGRAM_APP_SECRET } = webhookEnv()

  const declared = Number(req.headers.get("content-length") ?? "0")
  if (declared > MAX_BODY_BYTES) return text("Payload too large", 413)
  const raw = new Uint8Array(await req.arrayBuffer())
  if (raw.byteLength > MAX_BODY_BYTES) return text("Payload too large", 413)

  if (!verifyWebhookSignature(raw, req.headers.get("x-hub-signature-256"), INSTAGRAM_APP_SECRET)) {
    log.warn("webhook_bad_signature", { bytes: raw.byteLength })
    return text("Invalid signature", 401)
  }

  let body: unknown
  try {
    body = parseWebhookJson(new TextDecoder().decode(raw))
  } catch {
    log.warn("webhook_invalid_json", { bytes: raw.byteLength })
    return text("Invalid JSON", 400)
  }

  const comments = parseCommentEvents(body)
  const messages = parseMessagingEvents(body)
  if (comments.length === 0 && messages.length === 0) return text("EVENT_RECEIVED", 200)

  const database = db()

  // DMs only feed analytics, so they are recorded after the response.
  if (messages.length > 0) {
    const receivedAt = new Date()
    context.waitUntil(
      recordInboundMessages(database, messages, receivedAt).then(
        (counts) => log.info("webhook_messages_recorded", { events: messages.length, ...counts }),
        logRecordFailure,
      ),
    )
  }
  if (comments.length === 0) return text("EVENT_RECEIVED", 200)

  // Tag each event with its client up front, so the audit log is scoped even
  // if processing never runs.
  const igIds = [...new Set(comments.map((c) => c.igUserId))]
  const { data: accounts, error: accountError } = await database
    .from("instagram_accounts")
    .select("ig_user_id, client_id")
    .in("ig_user_id", igIds)
  if (accountError) {
    log.error("webhook_account_lookup_failed", { error: accountError.message })
    return text("Temporarily unavailable", 500)
  }
  const clientByIg = new Map((accounts ?? []).map((a) => [a.ig_user_id, a.client_id]))

  // ON CONFLICT (comment_id) DO NOTHING: Meta redelivers, and duplicates must
  // never be processed twice. Only newly inserted rows come back.
  const { data: inserted, error: insertError } = await database
    .from("comment_events")
    .upsert(
      comments.map((c) => ({
        comment_id: c.commentId,
        ig_user_id: c.igUserId,
        client_id: clientByIg.get(c.igUserId) ?? null,
        media_id: c.mediaId,
        commenter_id: c.commenterId,
        commenter_username: c.commenterUsername,
        comment_text: c.text.slice(0, 2200),
      })),
      { onConflict: "comment_id", ignoreDuplicates: true },
    )
    .select("id, client_id")

  if (insertError) {
    // A 500 makes Meta retry the delivery, so the comment is not lost.
    log.error("webhook_insert_failed", { error: insertError.message })
    return text("Temporarily unavailable", 500)
  }

  const ids = (inserted ?? []).map((r) => r.id)
  log.info("webhook_received", {
    comments: comments.length,
    new: ids.length,
    duplicates: comments.length - ids.length,
  })

  if (ids.length > 0) {
    // Respond to Meta now; process after the response. Anything unfinished
    // is picked up by the retry job, which also covers "received" rows.
    context.waitUntil(
      processEvents(ids, { db: database, ig: instagramClient() }).then(
        (counts) => log.info("webhook_processed", counts),
        (err: unknown) => log.error("webhook_processing_crashed", { error: err }),
      ),
    )
  }

  return text("EVENT_RECEIVED", 200)
}

export default async (req: Request, context: Context): Promise<Response> => {
  try {
    if (req.method === "GET") return await verifySubscription(req)
    if (req.method === "POST") return await receive(req, context)
    return text("Method not allowed", 405)
  } catch (err) {
    log.error("webhook_unhandled_error", { error: err })
    return text("Temporarily unavailable", 500)
  }
}

export const config: Config = {
  path: "/api/webhooks/instagram",
  method: ["GET", "POST"],
}
