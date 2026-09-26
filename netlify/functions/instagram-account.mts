import type { Config } from "@netlify/functions"

import { db } from "../../server/db"
import { assertSameOrigin, handle, json } from "../../server/http"
import {
  decryptAccountToken,
  getAccountForClient,
  instagramClient,
  pauseAutomationsForAccount,
} from "../../server/instagram/accounts"
import { log } from "../../server/log"
import { requireClient } from "../../server/session"

export default handle("instagram-account", async (req: Request) => {
  const client = await requireClient(req)
  const database = db()
  const account = await getAccountForClient(database, client.id)

  if (req.method === "GET") {
    if (!account || account.status === "revoked") return json({ account: null })
    return json({
      account: {
        username: account.username,
        profilePictureUrl: account.profile_picture_url,
        status: account.status,
        connectedAt: account.connected_at,
        tokenExpiresAt: account.token_expires_at,
      },
    })
  }

  // DELETE: disconnect.
  assertSameOrigin(req)
  if (!account) return json({ ok: true })

  // Best effort: stop Meta sending webhooks for this account before the
  // token is thrown away. A failure here must not block the disconnect.
  if (account.access_token_encrypted && account.status === "active") {
    try {
      await instagramClient().unsubscribe(decryptAccountToken(account))
    } catch (err) {
      log.warn("instagram_unsubscribe_failed", { clientId: client.id, error: err })
    }
  }

  await pauseAutomationsForAccount(database, account.id)
  const { error } = await database
    .from("instagram_accounts")
    .update({
      access_token_encrypted: null,
      token_expires_at: null,
      status: "revoked",
    })
    .eq("id", account.id)
  if (error) throw new Error(`Failed to disconnect Instagram: ${error.message}`)

  log.info("instagram_disconnected", { clientId: client.id, accountId: account.id })
  return json({ ok: true })
})

export const config: Config = {
  path: "/api/instagram/account",
  method: ["GET", "DELETE"],
}
