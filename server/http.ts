import type { Context } from "@netlify/functions"
import type { z } from "zod"

import { ConfigError } from "./env"
import { log } from "./log"

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
}

export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  const h = new Headers(JSON_HEADERS)
  new Headers(headers).forEach((value, key) => h.append(key, value))
  return new Response(JSON.stringify(data), { status, headers: h })
}

export function errorResponse(
  status: number,
  message: string,
  code?: string,
): Response {
  return json({ error: message, ...(code ? { code } : {}) }, status)
}

export function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" })
  for (const c of cookies) headers.append("Set-Cookie", c)
  return new Response(null, { status: 302, headers })
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

/** Maximum request body the API accepts. Automation payloads are tiny. */
const MAX_BODY_BYTES = 64 * 1024

export async function readBody(req: Request, maxBytes = MAX_BODY_BYTES) {
  const declared = Number(req.headers.get("content-length") ?? "0")
  if (declared > maxBytes) throw new HttpError(413, "Request body too large")
  const text = await req.text()
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new HttpError(413, "Request body too large")
  }
  return text
}

export async function readJson<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  const text = await readBody(req)
  let raw: unknown
  try {
    raw = text ? JSON.parse(text) : {}
  } catch {
    throw new HttpError(400, "Request body must be valid JSON")
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const where = first?.path.length ? `${first.path.join(".")}: ` : ""
    throw new HttpError(400, `${where}${first?.message ?? "Invalid request"}`, "VALIDATION")
  }
  return parsed.data
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie")
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(";")) {
    const idx = part.indexOf("=")
    if (idx === -1) continue
    const name = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!name) continue
    try {
      out[name] = decodeURIComponent(value)
    } catch {
      out[name] = value
    }
  }
  return out
}

interface CookieOptions {
  maxAgeSeconds?: number
  path?: string
  sameSite?: "Lax" | "Strict"
}

export function serializeCookie(
  name: string,
  value: string,
  { maxAgeSeconds, path = "/", sameSite = "Lax" }: CookieOptions = {},
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    "HttpOnly",
    "Secure",
    `SameSite=${sameSite}`,
  ]
  if (maxAgeSeconds !== undefined) parts.push(`Max-Age=${maxAgeSeconds}`)
  return parts.join("; ")
}

export function clearCookie(name: string, path = "/"): string {
  return `${name}=; Path=${path}; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export function clientIp(req: Request, context: Context): string {
  return (
    context.ip ||
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  )
}

/**
 * Rejects state changing requests from another origin. SameSite=Lax already
 * blocks cross site cookies on POST; this is defence in depth. Not used on
 * the Meta callbacks, which are legitimately cross origin.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin")
  if (!origin) return
  const requestHost = new URL(req.url).host
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw new HttpError(403, "Forbidden")
  }
  if (originHost !== requestHost) throw new HttpError(403, "Forbidden")
}

/**
 * Wraps a handler so thrown HttpErrors become clean JSON responses and
 * anything unexpected is logged without leaking internals to the client.
 */
export function handle(
  name: string,
  fn: (req: Request, context: Context) => Promise<Response>,
) {
  return async (req: Request, context: Context): Promise<Response> => {
    try {
      return await fn(req, context)
    } catch (err) {
      if (err instanceof HttpError) {
        return errorResponse(err.status, err.message, err.code)
      }
      if (err instanceof ConfigError) {
        log.error("config_error", { fn: name, error: err })
        return errorResponse(500, "The server is not configured yet.")
      }
      log.error("unhandled_error", { fn: name, error: err })
      return errorResponse(500, "Something went wrong. Please try again.")
    }
  }
}
