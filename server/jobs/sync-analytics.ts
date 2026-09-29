import type { Db } from "../db"
import { appEnv, cronEnv } from "../env"
import { startSyncRun, type StartResult, type SyncTrigger } from "../instagram/analytics-sync"
import { log } from "../log"

/**
 * Syncs run in a Netlify background function (15 minute limit), because a
 * first backfill can outlast the 60 second limit of a normal function. The
 * run is created here, under the database lock and throttle, and the worker
 * is handed its ID.
 */

export const SYNC_WORKER_PATH = "/api/internal/sync-analytics"
const DISPATCH_TIMEOUT_MS = 8_000
const DISPATCH_CONCURRENCY = 5

/** Hands a started run to the background worker. Closes the run if that fails. */
export async function dispatchSyncRun(
  database: Db,
  runId: string,
  accountId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(`${appEnv().APP_BASE_URL}${SYNC_WORKER_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronEnv().CRON_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ runId, accountId }),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    })
    if (res.ok) return true
    log.error("analytics_dispatch_rejected", { accountId, runId, status: res.status })
  } catch (err) {
    log.error("analytics_dispatch_failed", { accountId, runId, error: err })
  }
  const { error } = await database
    .from("ig_sync_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: "The sync could not be started. It will try again on the next run.",
    })
    .eq("id", runId)
  if (error) log.error("analytics_dispatch_close_failed", { runId, error: error.message })
  return false
}

/** Starts a run (honouring the lock and throttle) and hands it to the worker. */
export async function startAndDispatch(
  database: Db,
  accountId: string,
  trigger: SyncTrigger,
  minIntervalSeconds: number | null,
): Promise<StartResult & { dispatched?: boolean }> {
  const start = await startSyncRun(database, accountId, trigger, minIntervalSeconds)
  if (start.outcome !== "started") return start
  return { ...start, dispatched: await dispatchSyncRun(database, start.runId, accountId) }
}

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

/** The six hourly sync: one background run per connected account. */
export async function syncAllAccounts(
  database: Db,
  minIntervalSeconds: number,
): Promise<{ accounts: number; started: number; skipped: number; failed: number }> {
  const ids = await listSyncableAccounts(database)
  const counts = { accounts: ids.length, started: 0, skipped: 0, failed: 0 }
  let next = 0
  const lanes = Array.from({ length: Math.min(DISPATCH_CONCURRENCY, ids.length) }, async () => {
    while (next < ids.length) {
      const id = ids[next++] as string
      try {
        const result = await startAndDispatch(database, id, "cron", minIntervalSeconds)
        if (result.outcome !== "started") counts.skipped++
        else if (result.dispatched) counts.started++
        else counts.failed++
      } catch (err) {
        counts.failed++
        log.error("analytics_cron_account_failed", { accountId: id, error: err })
      }
    }
  })
  await Promise.all(lanes)
  return counts
}
