import type { Config } from "@netlify/functions"
import { z } from "zod"

import { randomToken } from "../../server/crypto"
import { db } from "../../server/db"
import { appEnv, appSecretEnv } from "../../server/env"
import { handle, json } from "../../server/http"
import { parseSignedRequest, readSignedRequestField } from "../../server/instagram/signed-request"
import { log } from "../../server/log"

const CodeSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/)

/**
 * POST: Meta's data deletion callback. Verifies the signed request, deletes
 * everything held for that Instagram user, and returns the status URL and
 * confirmation code in the shape Meta requires.
 *
 * GET ?code=...: status lookup behind the confirmation URL.
 */
export default handle("instagram-data-deletion", async (req: Request) => {
  if (req.method === "GET") {
    const code = CodeSchema.safeParse(new URL(req.url).searchParams.get("code"))
    if (!code.success) return json({ error: "Unknown confirmation code" }, 404)
    const { data, error } = await db()
      .from("data_deletion_requests")
      .select("status, requested_at, completed_at")
      .eq("confirmation_code", code.data)
      .maybeSingle()
    if (error) throw new Error(`Deletion status lookup failed: ${error.message}`)
    if (!data) return json({ error: "Unknown confirmation code" }, 404)
    return json({
      status: data.status,
      requestedAt: data.requested_at,
      completedAt: data.completed_at,
    })
  }

  const signed = await readSignedRequestField(req)
  const parsed = signed ? parseSignedRequest(signed, appSecretEnv().INSTAGRAM_APP_SECRET) : null
  if (!parsed) {
    log.warn("data_deletion_bad_signature")
    return json({ error: "Invalid signed_request" }, 400)
  }

  // Only a verified request from Meta reaches the database.
  const database = db()
  const userId = parsed.userId
  const { data: accounts, error: lookupError } = await database
    .from("instagram_accounts")
    .select("id, ig_user_id, client_id")
    .or(`ig_user_id.eq.${userId},ig_scoped_id.eq.${userId}`)
  if (lookupError) throw new Error(`Deletion lookup failed: ${lookupError.message}`)

  // Comment events for the connected account, and any comments this person
  // left on another client's posts.
  const igUserIds = [...new Set([userId, ...(accounts ?? []).map((a) => a.ig_user_id)])]
  const { error: eventsError } = await database
    .from("comment_events")
    .delete()
    .in("ig_user_id", igUserIds)
  if (eventsError) throw new Error(`Deleting comment events failed: ${eventsError.message}`)

  const { error: commenterError } = await database
    .from("comment_events")
    .delete()
    .eq("commenter_id", userId)
  if (commenterError) throw new Error(`Deleting commenter events failed: ${commenterError.message}`)

  // Conversation metadata where this person messaged a client.
  const { error: conversationError } = await database
    .from("ig_conversations")
    .delete()
    .eq("thread_key", userId)
  if (conversationError) {
    throw new Error(`Deleting conversation metadata failed: ${conversationError.message}`)
  }

  // Deleting the account cascades to its automations and all stored
  // analytics (daily metrics, media, insights, conversations, sync runs).
  if (accounts && accounts.length > 0) {
    const { error: accountError } = await database
      .from("instagram_accounts")
      .delete()
      .in("id", accounts.map((a) => a.id))
    if (accountError) throw new Error(`Deleting Instagram account failed: ${accountError.message}`)
  }

  const code = randomToken(18)
  const { error: recordError } = await database.from("data_deletion_requests").insert({
    confirmation_code: code,
    meta_user_id: userId,
    status: "completed",
    completed_at: new Date().toISOString(),
  })
  if (recordError) throw new Error(`Recording deletion failed: ${recordError.message}`)

  log.info("data_deleted", {
    accounts: accounts?.length ?? 0,
    clientIds: (accounts ?? []).map((a) => a.client_id),
  })

  return json({
    url: `${appEnv().APP_BASE_URL}/data-deletion?code=${code}`,
    confirmation_code: code,
  })
})

export const config: Config = {
  path: "/api/instagram/data-deletion",
  method: ["GET", "POST"],
}
