import { createHmac, timingSafeEqual } from "node:crypto"

import { parseWebhookJson } from "./webhook"

export interface SignedRequest {
  userId: string
  issuedAt: number | null
}

/**
 * Parses and verifies Meta's signed_request ("<sig>.<payload>", both
 * base64url), used by the deauthorize and data deletion callbacks. The
 * signature is HMAC-SHA256 of the encoded payload with the app secret.
 * Returns null for anything unsigned, tampered, or malformed.
 */
export function parseSignedRequest(signedRequest: string, appSecret: string): SignedRequest | null {
  if (!appSecret) return null
  const parts = signedRequest.split(".")
  if (parts.length !== 2) return null
  const [encodedSig, payload] = parts as [string, string]
  if (!/^[A-Za-z0-9_-]+$/.test(encodedSig) || !/^[A-Za-z0-9_-]+$/.test(payload)) return null

  const expected = createHmac("sha256", appSecret).update(payload).digest()
  const received = Buffer.from(encodedSig, "base64url")
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null

  let data: unknown
  try {
    data = parseWebhookJson(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (!data || typeof data !== "object") return null
  const d = data as { algorithm?: unknown; user_id?: unknown; issued_at?: unknown }
  if (typeof d.algorithm !== "string" || d.algorithm.toUpperCase() !== "HMAC-SHA256") return null
  if (typeof d.user_id !== "string" && typeof d.user_id !== "number") return null
  // Meta user IDs are numeric. Refusing anything else also means the ID can
  // be used safely inside a PostgREST filter string.
  const userId = String(d.user_id)
  if (!/^\d{1,40}$/.test(userId)) return null

  return {
    userId,
    issuedAt: typeof d.issued_at === "number" ? d.issued_at : null,
  }
}

/** Reads signed_request from Meta's form encoded POST body. */
export async function readSignedRequestField(req: Request): Promise<string | null> {
  const text = await req.text()
  if (text.length > 16 * 1024) return null
  return new URLSearchParams(text).get("signed_request")
}
