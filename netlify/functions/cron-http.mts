import type { Config, Context } from "@netlify/functions"
import { z } from "zod"

import { db } from "../../server/db"
import { handle, json } from "../../server/http"
import { instagramClient } from "../../server/instagram/accounts"
import { CONTINUATION_INTERVAL_SECONDS } from "../../server/instagram/analytics-sync"
import { isAuthorizedCron } from "../../server/jobs/cron-auth"
import { refreshExpiringTokens } from "../../server/jobs/refresh-tokens"
import { cleanupOldRecords, retryPendingEvents } from "../../server/jobs/retry-events"
import { startAndDispatch, syncAllAccounts } from "../../server/jobs/sync-analytics"

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
      const summary = await syncAllAccounts(database, CONTINUATION_INTERVAL_SECONDS)
      return json({ job: "sync-analytics", ...summary })
    }

    const accountId = AccountParam.safeParse(accountParam)
    if (!accountId.success) return json({ error: "Invalid account" }, 400)
    const start = await startAndDispatch(
      database,
      accountId.data,
      "manual",
      CONTINUATION_INTERVAL_SECONDS,
    )
    return json({ job: "sync-analytics", account: accountId.data, ...start }, 202)
  }
  return json({ error: "Unknown job" }, 404)
})

export const config: Config = {
  path: "/api/cron/:job",
  method: "POST",
}
