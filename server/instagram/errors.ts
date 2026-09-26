/**
 * Meta error classification. Every Graph failure becomes a MetaApiError with a
 * `kind` the processor can act on:
 *
 * - token:      the access token is invalid, expired, or revoked. Mark the
 *               account expired and stop; retrying cannot help.
 * - rate_limit: throttled. Leave the event failed so the retry job picks it up.
 * - transient:  network, timeout, or a Meta side 5xx. Retry later.
 * - permission: a missing permission or a policy block. Retrying cannot help.
 * - invalid:    the target no longer exists or the request is not allowed (a
 *               deleted comment, a closed reply window). Retrying cannot help.
 */

export type MetaErrorKind =
  | "token"
  | "rate_limit"
  | "transient"
  | "permission"
  | "invalid"

export class MetaApiError extends Error {
  constructor(
    readonly kind: MetaErrorKind,
    message: string,
    readonly details: {
      status?: number
      code?: number
      subcode?: number
      type?: string
      fbtraceId?: string
    } = {},
  ) {
    super(message)
    this.name = "MetaApiError"
  }

  get retryable(): boolean {
    return this.kind === "rate_limit" || this.kind === "transient"
  }
}

const TOKEN_CODES = new Set([102, 190])
const TOKEN_SUBCODES = new Set([458, 459, 460, 463, 464, 467, 492])
// Application, user, and Instagram business use case throttling.
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80002, 80006])
const TRANSIENT_CODES = new Set([1, 2])

export function classifyMetaError(
  status: number,
  code?: number,
  subcode?: number,
): MetaErrorKind {
  if (code !== undefined && TOKEN_CODES.has(code)) return "token"
  if (subcode !== undefined && TOKEN_SUBCODES.has(subcode)) return "token"
  if (code !== undefined && RATE_LIMIT_CODES.has(code)) return "rate_limit"
  if (status === 429) return "rate_limit"
  if (code !== undefined && TRANSIENT_CODES.has(code)) return "transient"
  if (status >= 500) return "transient"
  if (code === 10 || (code !== undefined && code >= 200 && code <= 299)) {
    return "permission"
  }
  if (status === 401) return "token"
  if (status === 403) return "permission"
  return "invalid"
}

interface GraphErrorBody {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
    error_user_msg?: string
  }
  // The api.instagram.com OAuth host uses a flatter shape.
  error_type?: string
  code?: number
  error_message?: string
}

export function parseMetaError(status: number, body: unknown): MetaApiError {
  const b = (body && typeof body === "object" ? body : {}) as GraphErrorBody
  const code = b.error?.code ?? b.code
  const subcode = b.error?.error_subcode
  const message =
    b.error?.error_user_msg ??
    b.error?.message ??
    b.error_message ??
    `Instagram request failed with status ${status}`
  return new MetaApiError(classifyMetaError(status, code, subcode), message, {
    status,
    code,
    subcode,
    type: b.error?.type ?? b.error_type,
    fbtraceId: b.error?.fbtrace_id,
  })
}

/**
 * Plain English for the activity log and the UI. Shown to clients, so it must
 * say what happened and, where possible, what to do about it.
 */
export function describeMetaError(err: unknown): string {
  if (!(err instanceof MetaApiError)) {
    return "Something unexpected went wrong. We will try again automatically."
  }
  switch (err.kind) {
    case "token":
      return "Instagram disconnected this account. Reconnect Instagram from the Automations page."
    case "rate_limit":
      return "Instagram asked us to slow down. We will retry automatically."
    case "transient":
      return "Instagram did not respond in time. We will retry automatically."
    case "permission":
      return "Instagram blocked this action. The account may be missing a permission, or the commenter has limited who can message them."
    case "invalid":
      return `Instagram rejected this request: ${err.message}`
  }
}
