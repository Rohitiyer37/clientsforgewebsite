import type { Config } from "@netlify/functions"

import { assertSameOrigin, handle, json } from "../../server/http"
import { destroySession } from "../../server/session"

export default handle("auth-logout", async (req: Request) => {
  assertSameOrigin(req)
  const cookie = await destroySession(req)
  return json({ ok: true }, 200, { "Set-Cookie": cookie })
})

export const config: Config = {
  path: "/api/auth/logout",
  method: "POST",
}
