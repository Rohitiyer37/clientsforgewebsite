import type { Config } from "@netlify/functions"
import { z } from "zod"

import { db } from "../../server/db"
import { BACKGROUND_DEADLINE_MS, runSync } from "../../server/instagram/analytics-sync"
import { isAuthorizedCron } from "../../server/jobs/cron-auth"
import { SYNC_WORKER_PATH } from "../../server/jobs/sync-analytics"
import { log } from "../../server/log"

const Body = z.object({ runId: z.string().uuid(), accountId: z.string().uuid() })

/**
 * Background worker for one analytics sync run. Netlify answers the caller
 * with 202 at once and lets this run for up to 15 minutes. Only our own
 * functions call it, with CRON_SECRET; the run must already exist.
 */
export default async (req: Request): Promise<void> => {
  if (!isAuthorizedCron(req)) {
    log.warn("sync_worker_unauthorized")
    return
  }
  let parsed: z.infer<typeof Body>
  try {
    parsed = Body.parse(await req.json())
  } catch {
    log.warn("sync_worker_bad_request")
    return
  }
  try {
    await runSync(parsed.runId, parsed.accountId, {
      db: db(),
      deadlineMs: BACKGROUND_DEADLINE_MS,
    })
  } catch (err) {
    log.error("sync_worker_failed", { ...parsed, error: err })
  }
}

export const config: Config = {
  path: SYNC_WORKER_PATH,
  method: "POST",
  background: true,
}
