import type { Config, Context } from "@netlify/functions"
import { z } from "zod"

import { db } from "../../server/db"
import { appEnv, cronEnv } from "../../server/env"
import { handle, json } from "../../server/http"
import { instagramClient } from "../../server/instagram/accounts"
import {
  CONTINUATION_INTERVAL_SECONDS,
  runSync,
  startSyncRun,
} from "../../server/instagram/analytics-sync"
import { isAuthorizedCron } from "../../server/jobs/cron-auth"
import { refreshExpiringTokens } from "../../server/jobs/refresh-tokens"
import { cleanupOldRecords, retryPendingEvents } from "../../server/jobs/retry-events"
import { dispatchAnalyticsSyncs } from "../../server/jobs/sync-analytics"
import { log } from "../../server/log"

const AccountParam = z.string().uuid()

/**
 * Manual triggers for the scheduled jobs, protected by CRON_SECRET. Useful for
 * testing and for forcing a run after an incident:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://clientsforge.com/api/cron/retry-events
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://clientsforge.com/api/cron/sync-analytics
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://clientsforge.com/api/cron/sync-analytics?account=<instagram_accounts.id>"
 */
export default handle("cron-http", async (req: Request, context: Context) => {
  if (!isAuthorizedCron(req)) return json({ error: "Unauthorized" }, 401)

  const database = db()

  if (context.params.job === "refresh-tokens") {
    const summary = await refreshExpiringTokens(database, instagramClient())
    await cleanupOldRecords(database)
    return json({ job: "refresh-tokens", ...summary })
  }
  if (context.params.job === "retry-events") {
    return json({
      job: "retry-events",
      ...(await retryPendingEvents(database, instagramClient())),
    })
  }
  if (context.params.job === "sync-analytics") {
    const accountParam = new URL(req.url).searchParams.get("account")
    if (accountParam === null) {
      const summary = await dispatchAnalyticsSyncs(database, {
        baseUrl: appEnv().APP_BASE_URL,
        cronSecret: cronEnv().CRON_SECRET,
      })
      return json({ job: "sync-analytics", ...summary })
    }

    const accountId = AccountParam.safeParse(accountParam)
    if (!accountId.success) return json({ error: "Invalid account" }, 400)
    const start = await startSyncRun(
      database,
      accountId.data,
      "cron",
      CONTINUATION_INTERVAL_SECONDS,
    )
    if (start.outcome === "started") {
      // Answer now so the dispatcher can move on; the sync runs after.
      context.waitUntil(
        runSync(start.runId, accountId.data, { db: database }).catch((err: unknown) =>
          log.error("cron_sync_analytics_account_failed", { accountId: accountId.data, error: err }),
        ),
      )
    }
    return json({ job: "sync-analytics", account: accountId.data, ...start }, 202)
  }
  return json({ error: "Unknown job" }, 404)
})

export const config: Config = {
  path: "/api/cron/:job",
  method: "POST",
}
