import type { Config, Context } from "@netlify/functions"

import { db } from "../../server/db"
import { handle, json } from "../../server/http"
import { instagramClient } from "../../server/instagram/accounts"
import { isAuthorizedCron } from "../../server/jobs/cron-auth"
import { refreshExpiringTokens } from "../../server/jobs/refresh-tokens"
import { cleanupOldRecords, retryPendingEvents } from "../../server/jobs/retry-events"

/**
 * Manual triggers for the scheduled jobs, protected by CRON_SECRET. Useful for
 * testing and for forcing a run after an incident:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://clientsforge.com/api/cron/retry-events
 */
export default handle("cron-http", async (req: Request, context: Context) => {
  if (!isAuthorizedCron(req)) return json({ error: "Unauthorized" }, 401)

  const database = db()
  const ig = instagramClient()

  if (context.params.job === "refresh-tokens") {
    const summary = await refreshExpiringTokens(database, ig)
    await cleanupOldRecords(database)
    return json({ job: "refresh-tokens", ...summary })
  }
  if (context.params.job === "retry-events") {
    return json({ job: "retry-events", ...(await retryPendingEvents(database, ig)) })
  }
  return json({ error: "Unknown job" }, 404)
})

export const config: Config = {
  path: "/api/cron/:job",
  method: "POST",
}
