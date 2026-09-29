import type { Config } from "@netlify/functions"

import { db } from "../../server/db"
import { CONTINUATION_INTERVAL_SECONDS } from "../../server/instagram/analytics-sync"
import { syncAllAccounts } from "../../server/jobs/sync-analytics"
import { log } from "../../server/log"

/**
 * Every 6 hours. Starts an analytics sync for every connected account. Also
 * exposed for manual runs at /api/cron/sync-analytics behind CRON_SECRET.
 */
export default async (): Promise<Response> => {
  try {
    const summary = await syncAllAccounts(db(), CONTINUATION_INTERVAL_SECONDS)
    log.info("cron_sync_analytics", summary)
  } catch (err) {
    log.error("cron_sync_analytics_failed", { error: err })
  }
  return new Response(null, { status: 204 })
}

export const config: Config = {
  schedule: "0 */6 * * *",
}
