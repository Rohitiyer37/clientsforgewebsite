import type { Db } from "../db"
import { log } from "../log"

const DISPATCH_CONCURRENCY = 5
const DISPATCH_TIMEOUT_MS = 8_000

/** Every account that can be synced: connected, with a token. */
export async function listSyncableAccounts(database: Db): Promise<string[]> {
  const { data, error } = await database
    .from("instagram_accounts")
    .select("id")
    .eq("status", "active")
    .not("access_token_encrypted", "is", null)
    .limit(1000)
  if (error) throw new Error(`Account list failed: ${error.message}`)
  return (data ?? []).map((a) => a.id)
}

/**
 * Starts one sync per account, each in its own function invocation so every
 * account gets a full time budget. The per account endpoint answers as soon
 * as its run has started, so this finishes well inside the scheduled
 * function limit.
 */
export async function dispatchAnalyticsSyncs(
  database: Db,
  opts: { baseUrl: string; cronSecret: string; fetchImpl?: typeof fetch },
): Promise<{ accounts: number; dispatched: number; failed: number }> {
  const ids = await listSyncableAccounts(database)
  const doFetch = opts.fetchImpl ?? fetch
  let dispatched = 0
  let failed = 0

  let next = 0
  const lanes = Array.from({ length: Math.min(DISPATCH_CONCURRENCY, ids.length) }, async () => {
    while (next < ids.length) {
      const id = ids[next++] as string
      try {
        const res = await doFetch(
          `${opts.baseUrl}/api/cron/sync-analytics?account=${encodeURIComponent(id)}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${opts.cronSecret}` },
            signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
          },
        )
        if (res.ok) dispatched++
        else {
          failed++
          log.warn("analytics_dispatch_rejected", { accountId: id, status: res.status })
        }
      } catch (err) {
        failed++
        log.warn("analytics_dispatch_failed", { accountId: id, error: err })
      }
    }
  })
  await Promise.all(lanes)
  return { accounts: ids.length, dispatched, failed }
}
