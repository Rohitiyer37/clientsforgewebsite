import type { Config } from "@netlify/functions"

import { db } from "../../server/db"
import { appSecretEnv } from "../../server/env"
import { handle, json } from "../../server/http"
import { pauseAutomationsForAccount } from "../../server/instagram/accounts"
import { parseSignedRequest, readSignedRequestField } from "../../server/instagram/signed-request"
import { log } from "../../server/log"

/**
 * Meta calls this when a user removes the app from their Instagram settings.
 * The account is marked revoked, its token discarded, and its automations
 * paused. It is not deleted: that is what the data deletion callback is for.
 */
export default handle("instagram-deauthorize", async (req: Request) => {
  const signed = await readSignedRequestField(req)
  const parsed = signed ? parseSignedRequest(signed, appSecretEnv().INSTAGRAM_APP_SECRET) : null
  if (!parsed) {
    log.warn("deauthorize_bad_signature")
    return json({ error: "Invalid signed_request" }, 400)
  }

  const database = db()
  const { data: accounts, error } = await database
    .from("instagram_accounts")
    .select("id, client_id")
    .or(`ig_user_id.eq.${parsed.userId},ig_scoped_id.eq.${parsed.userId}`)
  if (error) throw new Error(`Deauthorize lookup failed: ${error.message}`)

  for (const account of accounts ?? []) {
    await pauseAutomationsForAccount(database, account.id)
    const { error: updateError } = await database
      .from("instagram_accounts")
      .update({ status: "revoked", access_token_encrypted: null, token_expires_at: null })
      .eq("id", account.id)
    if (updateError) throw new Error(`Deauthorize update failed: ${updateError.message}`)
    log.info("instagram_deauthorized", { clientId: account.client_id, accountId: account.id })
  }

  return json({ ok: true })
})

export const config: Config = {
  path: "/api/instagram/deauthorize",
  method: "POST",
}
