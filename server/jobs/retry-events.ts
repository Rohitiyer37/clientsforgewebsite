import { processEvents, type ProcessOutcome } from "../automations/processor"
import { PRIVATE_REPLY_WINDOW_MS } from "../automations/rules"
import type { Db } from "../db"
import type { InstagramClient } from "../instagram/client"

/**
 * Retries events that failed with a retryable error, plus any left in
 * "received" (processing never ran, for example a cold start that timed out)
 * or stuck in "processing" (a crashed worker). Only events still inside the
 * 7 day reply window qualify; claim_comment_event enforces the attempt cap.
 */
export async function retryPendingEvents(
  database: Db,
  ig: InstagramClient,
  { now = new Date(), deadlineMs = 25_000 }: { now?: Date; deadlineMs?: number } = {},
): Promise<{ candidates: number } & Record<ProcessOutcome, number>> {
  const windowStart = new Date(now.getTime() - PRIVATE_REPLY_WINDOW_MS).toISOString()
  // Leave very fresh "received" rows to the webhook's own waitUntil.
  const settled = new Date(now.getTime() - 2 * 60 * 1000).toISOString()
  const stale = new Date(now.getTime() - 10 * 60 * 1000).toISOString()

  const { data, error } = await database
    .from("comment_events")
    .select("id")
    .lt("attempts", 3)
    .gt("received_at", windowStart)
    .or(
      [
        "and(status.eq.failed,retryable.eq.true)",
        `and(status.eq.received,received_at.lt."${settled}")`,
        `and(status.eq.processing,last_attempt_at.lt."${stale}")`,
      ].join(","),
    )
    .order("received_at", { ascending: true })
    .limit(50)
  if (error) throw new Error(`Retry query failed: ${error.message}`)

  const ids = (data ?? []).map((r) => r.id)
  const counts = await processEvents(ids, { db: database, ig }, deadlineMs)
  return { candidates: ids.length, ...counts }
}

/** Housekeeping: keeps the audit log and auth tables from growing forever. */
export async function cleanupOldRecords(database: Db, now = new Date()) {
  const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
  const results = await Promise.all([
    database.from("comment_events").delete().lt("received_at", days(90)),
    database.from("client_sessions").delete().lt("expires_at", now.toISOString()),
    database.from("login_attempts").delete().lt("attempted_at", days(30)),
  ])
  for (const r of results) {
    if (r.error) throw new Error(`Cleanup failed: ${r.error.message}`)
  }
}
