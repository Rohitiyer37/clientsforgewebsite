import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"

/** URL safe random token. 32 bytes gives 256 bits of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex")
}

export function hmacSha256Hex(key: string, data: string | Buffer): string {
  return createHmac("sha256", key).update(data).digest("hex")
}

/** Constant time string comparison. Unequal lengths return false. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

const TOKEN_FORMAT_VERSION = "v1"

function loadKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64")
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes")
  }
  return key
}

/**
 * AES-256-GCM. Output is "v1.<iv>.<tag>.<ciphertext>" in base64url, so the
 * format can change later without ambiguity. A fresh 96 bit IV is used for
 * every call, which GCM requires.
 */
export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = loadKey(keyBase64)
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    TOKEN_FORMAT_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".")
}

/** Throws if the payload was tampered with or the key is wrong. */
export function decryptSecret(payload: string, keyBase64: string): string {
  const parts = payload.split(".")
  if (parts.length !== 4 || parts[0] !== TOKEN_FORMAT_VERSION) {
    throw new Error("Unrecognised encrypted secret format")
  }
  const [, ivPart, tagPart, dataPart] = parts as [string, string, string, string]
  const key = loadKey(keyBase64)
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivPart, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
