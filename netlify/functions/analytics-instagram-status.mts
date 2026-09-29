import type { Config } from "@netlify/functions"

import { getSyncStatus } from "../../server/analytics/service"
import { db } from "../../server/db"
import { handle, json } from "../../server/http"
import { requireClient } from "../../server/session"

/** Sync status only. Polled by the page while the first sync is running. */
export default handle("analytics-instagram-status", async (req: Request) => {
  const client = await requireClient(req)
  return json({ sync: await getSyncStatus(db(), client.id) })
})

export const config: Config = {
  path: "/api/analytics/instagram/status",
  method: "GET",
}
