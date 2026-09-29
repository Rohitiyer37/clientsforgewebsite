import { hmacSha256Hex, randomToken, safeEqual } from "../crypto"
import { clearCookie, parseCookies, serializeCookie } from "../http"

export const OAUTH_STATE_COOKIE = "cf_ig_state"
const OAUTH_STATE_TTL_SECONDS = 10 * 60
const COOKIE_PATH = "/api/instagram"

/**
 * The OAuth state is random, stored in a short lived httpOnly cookie, and
 * bound to the signed in client with an HMAC. The callback accepts it only if
 * the state in the URL matches the cookie AND the HMAC matches the client who
 * is signed in now. That stops CSRF, and stops one client's authorization
 * from ever being attached to another client's workspace.
 */
export function createOAuthState(
  clientId: string,
  secret: string,
): { state: string; cookie: string } {
  const state = randomToken(24)
  const mac = hmacSha256Hex(secret, `${state}:${clientId}`)
  return {
    state,
    cookie: serializeCookie(OAUTH_STATE_COOKIE, `${state}.${mac}`, {
      maxAgeSeconds: OAUTH_STATE_TTL_SECONDS,
      path: COOKIE_PATH,
    }),
  }
}

export function verifyOAuthState(
  req: Request,
  stateParam: string | null,
  clientId: string,
  secret: string,
): boolean {
  if (!stateParam) return false
  const cookie = parseCookies(req)[OAUTH_STATE_COOKIE]
  if (!cookie) return false
  const dot = cookie.lastIndexOf(".")
  if (dot === -1) return false
  const cookieState = cookie.slice(0, dot)
  const cookieMac = cookie.slice(dot + 1)
  if (!safeEqual(cookieState, stateParam)) return false
  return safeEqual(cookieMac, hmacSha256Hex(secret, `${stateParam}:${clientId}`))
}

export function clearOAuthStateCookie(): string {
  return clearCookie(OAUTH_STATE_COOKIE, COOKIE_PATH)
}

/** Where the OAuth callback sends the client afterwards. Allowlisted. */
export const RETURN_DESTINATIONS = {
  automations: "/dashboard/automations",
  analytics: "/dashboard/analytics/instagram",
} as const
export type ReturnDestination = keyof typeof RETURN_DESTINATIONS
const RETURN_COOKIE = "cf_ig_return"

export function parseReturnDestination(value: string | null): ReturnDestination {
  return value === "analytics" ? "analytics" : "automations"
}

export function returnCookie(dest: ReturnDestination): string {
  return serializeCookie(RETURN_COOKIE, dest, {
    maxAgeSeconds: OAUTH_STATE_TTL_SECONDS,
    path: COOKIE_PATH,
  })
}

export function readReturnDestination(req: Request): ReturnDestination {
  return parseReturnDestination(parseCookies(req)[RETURN_COOKIE] ?? null)
}

export function clearReturnCookie(): string {
  return clearCookie(RETURN_COOKIE, COOKIE_PATH)
}
