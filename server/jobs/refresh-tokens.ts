import { decryptSecret, encryptSecret } from "../crypto"
import type { Db } from "../db"
import { cryptoEnv } from "../env"
import type { InstagramClient } from "../instagram/client"
import { MetaApiError } from "../instagram/errors"
import { markAccountExpired } from "../instagram/accounts"
import { log } from "../log"

const DAY_MS = 24 * 60 * 60 * 1000
const REFRESH_WINDOW_MS = 10 * DAY_MS
/** Meta refuses to refresh a token younger than 24 hours. */
const MIN_TOKEN_AGE_MS = DAY_MS
/** Past this point there is no later run to retry in, so give up cleanly. */
const LAST_CHANCE_MS = 2 * DAY_MS

export interface RefreshSummary {
  checked: number
  refreshed: number
  expired: number
  deferred: number
}

/**
 * Refreshes every active long lived token expiring within 10 days.
 *
 * A failure marks the account expired (showing the Reconnect banner) when
 * Meta rejects the token, or when the token is about to lapse anyway. A
 * transient failure with days to spare is deferred to the next daily run
 * rather than forcing the client to reconnect over a network blip.
 */
export async function refreshExpiringTokens(
  database: Db,
  ig: InstagramClient,
  { now = new Date(), deadlineMs = 25_000 }: { now?: Date; deadlineMs?: number } = {},
): Promise<RefreshSummary> {
  const started = Date.now()
  const summary: RefreshSummary = { checked: 0, refreshed: 0, expired: 0, deferred: 0 }
  const key = cryptoEnv().TOKEN_ENCRYPTION_KEY

  const { data: accounts, error } = await database
    .from("instagram_accounts")
    .select("*")
    .eq("status", "active")
    .not("access_token_encrypted", "is", null)
    .lt("token_expires_at", new Date(now.getTime() + REFRESH_WINDOW_MS).toISOString())
    .order("token_expires_at", { ascending: true })
    .limit(200)
  if (error) throw new Error(`Token refresh query failed: ${error.message}`)

  for (const account of accounts ?? []) {
    if (Date.now() - started > deadlineMs) break
    summary.checked++

    const refreshedAt = account.token_refreshed_at ?? account.connected_at
    if (now.getTime() - new Date(refreshedAt).getTime() < MIN_TOKEN_AGE_MS) {
      summary.deferred++
      continue
    }

    try {
      const token = decryptSecret(account.access_token_encrypted as string, key)
      const next = await ig.refreshLongLived(token)
      const { error: updateError } = await database
        .from("instagram_accounts")
        .update({
          access_token_encrypted: encryptSecret(next.accessToken, key),
          token_expires_at: new Date(now.getTime() + next.expiresInSeconds * 1000).toISOString(),
          token_refreshed_at: now.toISOString(),
        })
        .eq("id", account.id)
      if (updateError) throw new Error(`Failed to store refreshed token: ${updateError.message}`)
      summary.refreshed++
      log.info("token_refreshed", { accountId: account.id, clientId: account.client_id })
    } catch (err) {
      const expiresAt = account.token_expires_at
        ? new Date(account.token_expires_at).getTime()
        : 0
      const lastChance = expiresAt - now.getTime() < LAST_CHANCE_MS
      const rejected = err instanceof MetaApiError && !err.retryable

      if (rejected || lastChance) {
        await markAccountExpired(
          database,
          account.id,
          err instanceof Error ? err.message : "Token refresh failed",
        )
        summary.expired++
      } else {
        summary.deferred++
        log.warn("token_refresh_deferred", {
          accountId: account.id,
          clientId: account.client_id,
          error: err,
        })
      }
    }
  }

  return summary
}
