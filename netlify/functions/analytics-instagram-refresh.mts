import type { Config } from "@netlify/functions"

import { getSyncStatus } from "../../server/analytics/service"
import { db } from "../../server/db"
import { assertSameOrigin, handle, json } from "../../server/http"
import { requireActiveAccount } from "../../server/instagram/accounts"
import {
  CONTINUATION_INTERVAL_SECONDS,
  REFRESH_INTERVAL_SECONDS,
} from "../../server/instagram/analytics-sync"
import { startAndDispatch } from "../../server/jobs/sync-analytics"
import { requireClient } from "../../server/session"

/**
 * POST: sync the signed in client's account now. Throttled to once per 15
 * minutes per account. While the first backfill is still in progress, the
 * page may continue it once a minute instead.
 */
export default handle("analytics-instagram-refresh", async (req: Request) => {
  assertSameOrigin(req)
  const client = await requireClient(req)
  const database = db()
  const { account } = await requireActiveAccount(database, client.id)

  const { data: state, error } = await database
    .from("ig_analytics_state")
    .select("backfill_completed_at")
    .eq("instagram_account_id", account.id)
    .maybeSingle()
  if (error) throw new Error(`Analytics state lookup failed: ${error.message}`)
  const continuing = !state?.backfill_completed_at

  const start = await startAndDispatch(
    database,
    account.id,
    continuing ? "continuation" : "manual",
    continuing ? CONTINUATION_INTERVAL_SECONDS : REFRESH_INTERVAL_SECONDS,
  )

  if (start.outcome === "throttled") {
    const minutes = Math.ceil(start.retryAfterSeconds / 60)
    return json(
      {
        error: `You can refresh again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        code: "THROTTLED",
        retryAfterSeconds: start.retryAfterSeconds,
      },
      429,
      { "Retry-After": String(start.retryAfterSeconds) },
    )
  }

  return json({ sync: await getSyncStatus(database, client.id) }, 202)
})

export const config: Config = {
  path: "/api/analytics/instagram/refresh",
  method: "POST",
}
