import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"

import { parseSignedRequest } from "./signed-request"

const SECRET = "app-secret-123"

function make(payload: object | string, secret = SECRET): string {
  const body = Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload)).toString(
    "base64url",
  )
  const sig = createHmac("sha256", secret).update(body).digest("base64url")
  return `${sig}.${body}`
}

describe("Meta signed_request", () => {
  it("returns the user for a valid request", () => {
    expect(
      parseSignedRequest(make({ algorithm: "HMAC-SHA256", user_id: "123", issued_at: 1760000000 }), SECRET),
    ).toEqual({ userId: "123", issuedAt: 1760000000 })
  })

  it("keeps a large numeric user_id exact", () => {
    const signed = make('{"algorithm":"HMAC-SHA256","user_id":17841400000000001}')
    expect(parseSignedRequest(signed, SECRET)?.userId).toBe("17841400000000001")
  })

  it("rejects a request signed with another secret", () => {
    expect(parseSignedRequest(make({ algorithm: "HMAC-SHA256", user_id: "1" }, "other"), SECRET)).toBeNull()
  })

  it("rejects a tampered payload", () => {
    const [sig] = make({ algorithm: "HMAC-SHA256", user_id: "1" }).split(".")
    const forged = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "999" })).toString("base64url")
    expect(parseSignedRequest(`${sig}.${forged}`, SECRET)).toBeNull()
  })

  it("rejects a non numeric user_id, even when correctly signed", () => {
    const injection = make({ algorithm: "HMAC-SHA256", user_id: "1,ig_scoped_id.neq.0" })
    expect(parseSignedRequest(injection, SECRET)).toBeNull()
  })

  it("rejects an unexpected algorithm", () => {
    expect(parseSignedRequest(make({ algorithm: "none", user_id: "1" }), SECRET)).toBeNull()
  })

  it.each(["", "abc", "a.b.c", "!!.??"])("rejects malformed input %j", (input) => {
    expect(parseSignedRequest(input, SECRET)).toBeNull()
  })

  it("rejects when no secret is configured", () => {
    expect(parseSignedRequest(make({ algorithm: "HMAC-SHA256", user_id: "1" }, ""), "")).toBeNull()
  })
})
