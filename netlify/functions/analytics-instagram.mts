import type { Config } from "@netlify/functions"

import { AnalyticsQuerySchema } from "../../shared/analytics"
import { getInstagramAnalytics } from "../../server/analytics/service"
import { db } from "../../server/db"
import { HttpError, handle, json } from "../../server/http"
import { requireClient } from "../../server/session"

/**
 * GET /api/analytics/instagram?range=30d  or  ?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Everything the analytics page shows, for the signed in client only.
 */
export default handle("analytics-instagram", async (req: Request) => {
  const client = await requireClient(req)
  const params = new URL(req.url).searchParams
  const parsed = AnalyticsQuerySchema.safeParse({
    range: params.get("range") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  })
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid date range", "INVALID_RANGE")
  }
  return json(await getInstagramAnalytics(db(), client.id, parsed.data))
})

export const config: Config = {
  path: "/api/analytics/instagram",
  method: "GET",
}
