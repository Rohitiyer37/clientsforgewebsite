import { decryptSecret } from "../crypto"
import type { Db } from "../db"
import type { Row } from "../database.types"
import { cryptoEnv, instagramEnv } from "../env"
import { HttpError } from "../http"
import { log } from "../log"
import { InstagramClient } from "./client"
import { MetaApiError } from "./errors"

export type InstagramAccountRow = Row<"instagram_accounts">

export function instagramClient(): InstagramClient {
  return new InstagramClient({ version: instagramEnv().META_GRAPH_API_VERSION })
}

export function decryptAccountToken(account: InstagramAccountRow): string {
  if (!account.access_token_encrypted) {
    throw new HttpError(409, "Instagram is not connected.", "IG_NOT_CONNECTED")
  }
  return decryptSecret(account.access_token_encrypted, cryptoEnv().TOKEN_ENCRYPTION_KEY)
}

export async function getAccountForClient(
  database: Db,
  clientId: string,
): Promise<InstagramAccountRow | null> {
  const { data, error } = await database
    .from("instagram_accounts")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle()
  if (error) throw new Error(`Instagram account lookup failed: ${error.message}`)
  return data
}

/**
 * The connected account plus its decrypted token, for routes that call the
 * Graph API on the client's behalf. Throws a 409 the UI understands when the
 * account is missing or needs reconnecting.
 */
export async function requireActiveAccount(
  database: Db,
  clientId: string,
): Promise<{ account: InstagramAccountRow; token: string }> {
  const account = await getAccountForClient(database, clientId)
  if (!account || account.status === "revoked" || !account.access_token_encrypted) {
    throw new HttpError(409, "Connect Instagram first.", "IG_NOT_CONNECTED")
  }
  if (account.status === "expired") {
    throw new HttpError(409, "Reconnect Instagram to continue.", "IG_EXPIRED")
  }
  return { account, token: decryptAccountToken(account) }
}

export async function pauseAutomationsForAccount(
  database: Db,
  accountId: string,
): Promise<void> {
  const { error } = await database
    .from("automations")
    .update({ is_active: false })
    .eq("instagram_account_id", accountId)
    .eq("is_active", true)
  if (error) throw new Error(`Failed to pause automations: ${error.message}`)
}

export async function markAccountExpired(
  database: Db,
  accountId: string,
  reason: string,
): Promise<void> {
  const { error } = await database
    .from("instagram_accounts")
    .update({ status: "expired" })
    .eq("id", accountId)
  if (error) throw new Error(`Failed to mark account expired: ${error.message}`)
  log.warn("instagram_account_expired", { accountId, reason })
}

/**
 * Converts a token failure from a dashboard route into the 409 the UI shows
 * as a "Reconnect Instagram" banner, marking the account expired on the way.
 */
export async function handleGraphError(
  database: Db,
  account: InstagramAccountRow,
  err: unknown,
): Promise<never> {
  if (err instanceof MetaApiError && err.kind === "token") {
    await markAccountExpired(database, account.id, err.message)
    throw new HttpError(409, "Reconnect Instagram to continue.", "IG_EXPIRED")
  }
  if (err instanceof MetaApiError) {
    log.warn("graph_request_failed", {
      accountId: account.id,
      clientId: account.client_id,
      kind: err.kind,
      code: err.details.code,
    })
    throw new HttpError(502, "Instagram did not respond as expected. Try again in a moment.")
  }
  throw err
}
