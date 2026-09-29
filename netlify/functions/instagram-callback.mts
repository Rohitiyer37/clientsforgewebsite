import type { Config } from "@netlify/functions"

import { encryptSecret } from "../../server/crypto"
import { db } from "../../server/db"
import { appEnv, cryptoEnv, instagramEnv, sessionEnv } from "../../server/env"
import { handle, redirect } from "../../server/http"
import {
  getAccountForClient,
  instagramClient,
  pauseAutomationsForAccount,
} from "../../server/instagram/accounts"
import { startAndDispatch } from "../../server/jobs/sync-analytics"
import { INSIGHTS_SCOPE, REQUIRED_SCOPES } from "../../server/instagram/client"
import { MetaApiError } from "../../server/instagram/errors"
import {
  RETURN_DESTINATIONS,
  clearOAuthStateCookie,
  clearReturnCookie,
  readReturnDestination,
  verifyOAuthState,
  type ReturnDestination,
} from "../../server/instagram/oauth"
import { log } from "../../server/log"
import { getCurrentClient } from "../../server/session"

const PROFESSIONAL_ACCOUNT_TYPES = new Set(["BUSINESS", "MEDIA_CREATOR", "CREATOR"])

function backTo(dest: ReturnDestination, result: string): Response {
  return redirect(`${RETURN_DESTINATIONS[dest]}?ig=${encodeURIComponent(result)}`, [
    clearOAuthStateCookie(),
    clearReturnCookie(),
  ])
}

export default handle("instagram-callback", async (req: Request) => {
  const client = await getCurrentClient(req)
  if (!client) return redirect("/dashboard", [clearOAuthStateCookie(), clearReturnCookie()])

  const dest = readReturnDestination(req)
  const back = (result: string) => backTo(dest, result)
  const url = new URL(req.url)

  // The user cancelled or refused permissions on Instagram's screen.
  if (url.searchParams.get("error")) {
    log.info("instagram_connect_denied", {
      clientId: client.id,
      reason: url.searchParams.get("error_reason"),
    })
    return back("denied")
  }

  if (
    !verifyOAuthState(req, url.searchParams.get("state"), client.id, sessionEnv().SESSION_SECRET)
  ) {
    log.warn("instagram_connect_bad_state", { clientId: client.id })
    return back("state")
  }

  const code = url.searchParams.get("code")
  if (!code) return back("failed")

  const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET } = instagramEnv()
  const { APP_BASE_URL } = appEnv()
  const ig = instagramClient()
  const database = db()

  try {
    const short = await ig.exchangeCode({
      appId: INSTAGRAM_APP_ID,
      appSecret: INSTAGRAM_APP_SECRET,
      redirectUri: `${APP_BASE_URL}/api/instagram/callback`,
      code,
    })

    // Automations cannot work without these. Insights is optional: without
    // it only Content Analytics is affected, and it shows a reconnect banner.
    const missing = REQUIRED_SCOPES.filter(
      (p) => short.permissions.length > 0 && !short.permissions.includes(p),
    )
    if (missing.length > 0) {
      log.info("instagram_connect_missing_permissions", { clientId: client.id, missing })
      return back("permissions")
    }

    const long = await ig.exchangeForLongLived({
      appSecret: INSTAGRAM_APP_SECRET,
      shortLivedToken: short.accessToken,
    })
    const profile = await ig.getProfile(long.accessToken)

    if (profile.accountType && !PROFESSIONAL_ACCOUNT_TYPES.has(profile.accountType)) {
      return back("not_professional")
    }

    // One Instagram account can belong to one workspace, because webhooks
    // are routed by account ID.
    const { data: owner, error: ownerError } = await database
      .from("instagram_accounts")
      .select("client_id")
      .eq("ig_user_id", profile.userId)
      .maybeSingle()
    if (ownerError) throw new Error(`Ownership lookup failed: ${ownerError.message}`)
    if (owner && owner.client_id !== client.id) {
      log.warn("instagram_connect_in_use", { clientId: client.id })
      return back("in_use")
    }

    // Without this subscription Meta never sends comment webhooks, so a
    // "connected" account would silently do nothing. Fail loudly instead.
    await ig.subscribeToWebhooks(long.accessToken)

    const previous = await getAccountForClient(database, client.id)
    const { data: saved, error: saveError } = await database
      .from("instagram_accounts")
      .upsert(
        {
          client_id: client.id,
          ig_user_id: profile.userId,
          ig_scoped_id: profile.scopedId,
          username: profile.username,
          profile_picture_url: profile.profilePictureUrl,
          access_token_encrypted: encryptSecret(
            long.accessToken,
            cryptoEnv().TOKEN_ENCRYPTION_KEY,
          ),
          token_expires_at: new Date(Date.now() + long.expiresInSeconds * 1000).toISOString(),
          token_refreshed_at: new Date().toISOString(),
          connected_at: new Date().toISOString(),
          status: "active",
          granted_scopes: short.permissions.length > 0 ? short.permissions : null,
        },
        { onConflict: "client_id" },
      )
      .select("id")
      .single()
    if (saveError) throw new Error(`Failed to save Instagram account: ${saveError.message}`)

    // A different Instagram account replaced the old one: its automations
    // point at the old account's posts, so they must not run.
    if (previous && previous.ig_user_id !== profile.userId) {
      await pauseAutomationsForAccount(database, saved.id)
      // Its stored analytics belong to the old account too.
      const { error: resetError } = await database.rpc("reset_ig_analytics", {
        p_account_id: saved.id,
      })
      if (resetError) throw new Error(`Failed to reset analytics: ${resetError.message}`)
    }

    // Insights access is re-checked by the first sync; if Instagram said the
    // permission was left out, the banner shows at once.
    const insightsGranted =
      short.permissions.length === 0 || short.permissions.includes(INSIGHTS_SCOPE)
    const { error: stateError } = await database.from("ig_analytics_state").upsert(
      {
        instagram_account_id: saved.id,
        insights_status: insightsGranted ? "unknown" : "missing_permission",
      },
      { onConflict: "instagram_account_id" },
    )
    if (stateError) throw new Error(`Failed to save analytics state: ${stateError.message}`)

    // First sync right away, in the background worker.
    const first = await startAndDispatch(database, saved.id, "connect", null)
    log.info("instagram_connect_sync", { clientId: client.id, outcome: first.outcome })

    log.info("instagram_connected", { clientId: client.id, accountId: saved.id })
    return back("connected")
  } catch (err) {
    if (err instanceof MetaApiError) {
      log.warn("instagram_connect_failed", {
        clientId: client.id,
        kind: err.kind,
        code: err.details.code,
        subcode: err.details.subcode,
        message: err.message,
      })
      // Personal accounts are refused at the token step with an error that
      // mentions the account type.
      if (/professional|business|creator|account type/i.test(err.message)) {
        return back("not_professional")
      }
      return back("failed")
    }
    throw err
  }
})

export const config: Config = {
  path: "/api/instagram/callback",
  method: "GET",
}
