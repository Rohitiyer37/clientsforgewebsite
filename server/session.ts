import { randomToken, sha256Hex } from "./crypto"
import { db, type Db } from "./db"
import {
  HttpError,
  clearCookie,
  parseCookies,
  serializeCookie,
} from "./http"

export const SESSION_COOKIE = "cf_session"
export const SESSION_TTL_DAYS = 180
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60
/** Only write last_seen_at once an hour to avoid a write on every request. */
const LAST_SEEN_THROTTLE_MS = 60 * 60 * 1000
/** base64url of 32 bytes is 43 characters. Anything else is not ours. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export interface CurrentClient {
  id: string
  name: string
  sessionId: string
}

export async function createSession(
  clientId: string,
  meta: { userAgent: string | null; ip: string },
  databaseOverride?: Db,
): Promise<{ cookie: string }> {
  const database = databaseOverride ?? db()
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  const { error } = await database.from("client_sessions").insert({
    client_id: clientId,
    token_hash: sha256Hex(token),
    expires_at: expiresAt.toISOString(),
    user_agent: meta.userAgent?.slice(0, 400) ?? null,
    ip: meta.ip,
  })
  if (error) throw new Error(`Failed to create session: ${error.message}`)

  return {
    cookie: serializeCookie(SESSION_COOKIE, token, {
      maxAgeSeconds: SESSION_TTL_SECONDS,
    }),
  }
}

function readToken(req: Request): string | null {
  const token = parseCookies(req)[SESSION_COOKIE]
  return token && TOKEN_PATTERN.test(token) ? token : null
}

/**
 * Resolves the signed in client from the session cookie, or null. Every
 * dashboard API calls this, and all data is scoped by the id it returns,
 * never by anything in the request body or query string.
 *
 * Returns null when there is no cookie, the session is unknown or expired, or
 * the client has been deactivated. Deactivation therefore locks a client out
 * on their very next request.
 */
export async function getCurrentClient(
  req: Request,
  databaseOverride?: Db,
): Promise<CurrentClient | null> {
  // Check the cookie before touching the database: anonymous requests should
  // cost nothing and must not depend on the database being reachable.
  const token = readToken(req)
  if (!token) return null

  const database = databaseOverride ?? db()
  const { data, error } = await database
    .from("client_sessions")
    .select("id, expires_at, last_seen_at, client:clients!inner(id, name, is_active)")
    .eq("token_hash", sha256Hex(token))
    .maybeSingle()

  if (error) throw new Error(`Session lookup failed: ${error.message}`)
  if (!data) return null

  const now = Date.now()
  if (new Date(data.expires_at).getTime() <= now) {
    await database.from("client_sessions").delete().eq("id", data.id)
    return null
  }
  if (!data.client.is_active) return null

  if (now - new Date(data.last_seen_at).getTime() > LAST_SEEN_THROTTLE_MS) {
    await database
      .from("client_sessions")
      .update({ last_seen_at: new Date(now).toISOString() })
      .eq("id", data.id)
  }

  return { id: data.client.id, name: data.client.name, sessionId: data.id }
}

/** Like getCurrentClient, but throws a 401 for API routes. */
export async function requireClient(req: Request): Promise<CurrentClient> {
  const client = await getCurrentClient(req)
  if (!client) throw new HttpError(401, "Not signed in", "UNAUTHENTICATED")
  return client
}

/** Deletes the session row and returns the cookie that clears the browser. */
export async function destroySession(
  req: Request,
  databaseOverride?: Db,
): Promise<string> {
  const token = readToken(req)
  if (token) {
    const database = databaseOverride ?? db()
    await database.from("client_sessions").delete().eq("token_hash", sha256Hex(token))
  }
  return clearCookie(SESSION_COOKIE)
}
