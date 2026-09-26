import type { Config } from "@netlify/functions"

import { errorResponse, handle, json } from "../../server/http"
import { getCurrentClient } from "../../server/session"

/** The dashboard shell calls this to decide between the PIN screen and the app. */
export default handle("me", async (req: Request) => {
  const client = await getCurrentClient(req)
  if (!client) return errorResponse(401, "Not signed in", "UNAUTHENTICATED")
  return json({ client: { id: client.id, name: client.name } })
})

export const config: Config = {
  path: "/api/me",
  method: "GET",
}
