import type { Config, Context } from "@netlify/functions"

import {
  LoginSchema,
  PIN_FAILED_MESSAGE,
  RATE_LIMITED_MESSAGE,
} from "../../shared/auth"
import { db } from "../../server/db"
import {
  assertSameOrigin,
  clientIp,
  errorResponse,
  handle,
  json,
  readJson,
} from "../../server/http"
import { log } from "../../server/log"
import { isLoginAllowed, supabaseAttemptStore } from "../../server/rate-limit"
import { createSession } from "../../server/session"

export default handle("auth-login", async (req: Request, context: Context) => {
  assertSameOrigin(req)
  const ip = clientIp(req, context)
  const store = supabaseAttemptStore(db())

  // Rate limit before touching the PIN, so a locked out IP learns nothing.
  if (!(await isLoginAllowed(store, ip))) {
    await store.record(ip, false)
    log.warn("login_rate_limited", { ip })
    return errorResponse(429, RATE_LIMITED_MESSAGE, "RATE_LIMITED")
  }

  const { pin } = await readJson(req, LoginSchema)

  const { data, error } = await db().rpc("verify_client_pin", { p_pin: pin })
  if (error) throw new Error(`PIN verification failed: ${error.message}`)
  const client = data?.[0]

  await store.record(ip, Boolean(client))

  if (!client) {
    log.info("login_failed", { ip })
    return errorResponse(401, PIN_FAILED_MESSAGE, "INVALID_PIN")
  }

  const { cookie } = await createSession(client.id, {
    userAgent: req.headers.get("user-agent"),
    ip,
  })

  await db()
    .from("clients")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", client.id)

  log.info("login_succeeded", { clientId: client.id, ip })
  return json(
    { client: { id: client.id, name: client.name } },
    200,
    { "Set-Cookie": cookie },
  )
})

export const config: Config = {
  path: "/api/auth/login",
  method: "POST",
}
