import type { Config } from "@netlify/functions"

import { db } from "../../server/db"
import { instagramClient } from "../../server/instagram/accounts"
import { refreshExpiringTokens } from "../../server/jobs/refresh-tokens"
import { cleanupOldRecords } from "../../server/jobs/retry-events"
import { log } from "../../server/log"

/**
 * Daily. Netlify invokes scheduled functions internally; they cannot be
 * reached by URL, so they need no secret. The same job is exposed for manual
 * runs at /api/cron/refresh-tokens behind CRON_SECRET.
 */
export default async (): Promise<Response> => {
  try {
    const database = db()
    const summary = await refreshExpiringTokens(database, instagramClient())
    await cleanupOldRecords(database)
    log.info("cron_refresh_tokens", { ...summary })
  } catch (err) {
    log.error("cron_refresh_tokens_failed", { error: err })
  }
  return new Response(null, { status: 204 })
}

export const config: Config = {
  schedule: "@daily",
}
