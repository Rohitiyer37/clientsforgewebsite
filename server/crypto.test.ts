import { randomBytes } from "node:crypto"
import { describe, expect, it } from "vitest"

import {
  decryptSecret,
  encryptSecret,
  hmacSha256Hex,
  randomToken,
  safeEqual,
  sha256Hex,
} from "./crypto"

const KEY = randomBytes(32).toString("base64")
const TOKEN = "IGAAB1234.example-long-lived-token_value"

describe("token encryption", () => {
  it("round trips a token", () => {
    expect(decryptSecret(encryptSecret(TOKEN, KEY), KEY)).toBe(TOKEN)
  })

  it("never contains the plaintext", () => {
    expect(encryptSecret(TOKEN, KEY)).not.toContain(TOKEN)
  })

  it("uses a fresh IV, so the same token encrypts differently each time", () => {
    expect(encryptSecret(TOKEN, KEY)).not.toBe(encryptSecret(TOKEN, KEY))
  })

  it("rejects a tampered ciphertext", () => {
    const [v, iv, tag, data] = encryptSecret(TOKEN, KEY).split(".") as [
      string,
      string,
      string,
      string,
    ]
    const flipped = Buffer.from(data, "base64url")
    flipped[0] = (flipped[0] ?? 0) ^ 0xff
    const tampered = [v, iv, tag, flipped.toString("base64url")].join(".")
    expect(() => decryptSecret(tampered, KEY)).toThrow()
  })

  it("rejects decryption with the wrong key", () => {
    const other = randomBytes(32).toString("base64")
    expect(() => decryptSecret(encryptSecret(TOKEN, KEY), other)).toThrow()
  })

  it("rejects a key that is not 32 bytes", () => {
    const short = randomBytes(16).toString("base64")
    expect(() => encryptSecret(TOKEN, short)).toThrow(/32 bytes/)
  })

  it("rejects an unknown format", () => {
    expect(() => decryptSecret("v9.a.b.c", KEY)).toThrow(/format/)
    expect(() => decryptSecret("not-encrypted", KEY)).toThrow(/format/)
  })
})

describe("crypto helpers", () => {
  it("generates 43 character base64url tokens with no collisions", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => randomToken()))
    expect(tokens.size).toBe(500)
    for (const t of tokens) expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it("hashes deterministically", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    )
  })

  it("compares strings in constant time and handles unequal lengths", () => {
    expect(safeEqual("secret", "secret")).toBe(true)
    expect(safeEqual("secret", "secreT")).toBe(false)
    expect(safeEqual("secret", "secret-longer")).toBe(false)
  })

  it("produces a known HMAC", () => {
    expect(hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog")).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    )
  })
})
