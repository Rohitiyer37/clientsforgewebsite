import type { Config } from "@netlify/functions"

import { db } from "../../server/db"
import { instagramClient } from "../../server/instagram/accounts"
import { retryPendingEvents } from "../../server/jobs/retry-events"
import { log } from "../../server/log"

/**
 * Every 5 minutes. Retries failed events still inside the 7 day window. Also
 * exposed for manual runs at /api/cron/retry-events behind CRON_SECRET.
 */
export default async (): Promise<Response> => {
  try {
    const summary = await retryPendingEvents(db(), instagramClient())
    if (summary.candidates > 0) log.info("cron_retry_events", { ...summary })
  } catch (err) {
    log.error("cron_retry_events_failed", { error: err })
  }
  return new Response(null, { status: 204 })
}

export const config: Config = {
  schedule: "*/5 * * * *",
}
