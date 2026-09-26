import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"

import { parseCommentEvents, parseWebhookJson, verifyWebhookSignature } from "./webhook"

const SECRET = "test-app-secret-9f2c"
const enc = (s: string) => new TextEncoder().encode(s)
const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(enc(body)).digest("hex")}`

const BODY = JSON.stringify({ object: "instagram", entry: [] })

describe("webhook signature verification", () => {
  it("accepts a correct signature", () => {
    expect(verifyWebhookSignature(enc(BODY), sign(BODY), SECRET)).toBe(true)
  })

  it("accepts an uppercase hex signature", () => {
    expect(verifyWebhookSignature(enc(BODY), sign(BODY).toUpperCase().replace("SHA256", "sha256"), SECRET)).toBe(true)
  })

  it("rejects a signature made with a different secret", () => {
    expect(verifyWebhookSignature(enc(BODY), sign(BODY, "wrong-secret"), SECRET)).toBe(false)
  })

  it("rejects a body that changed after signing", () => {
    const tampered = BODY.replace("[]", '[{"id":"1"}]')
    expect(verifyWebhookSignature(enc(tampered), sign(BODY), SECRET)).toBe(false)
  })

  it("is byte exact: whitespace changes break the signature", () => {
    expect(verifyWebhookSignature(enc(`${BODY} `), sign(BODY), SECRET)).toBe(false)
  })

  it("verifies non ASCII bodies over their UTF-8 bytes", () => {
    const body = JSON.stringify({ object: "instagram", entry: [], note: "गाइड 🔥" })
    expect(verifyWebhookSignature(enc(body), sign(body), SECRET)).toBe(true)
  })

  it.each([
    ["missing header", null],
    ["empty header", ""],
    ["no prefix", createHmac("sha256", SECRET).update(BODY).digest("hex")],
    ["sha1 prefix", `sha1=${createHmac("sha1", SECRET).update(BODY).digest("hex")}`],
    ["truncated", sign(BODY).slice(0, 40)],
    ["non hex", `sha256=${"z".repeat(64)}`],
  ])("rejects %s", (_label, header) => {
    expect(verifyWebhookSignature(enc(BODY), header, SECRET)).toBe(false)
  })

  it("rejects when the app secret is not configured", () => {
    expect(verifyWebhookSignature(enc(BODY), sign(BODY, ""), "")).toBe(false)
  })
})

describe("comment payload parsing", () => {
  it("parses the Instagram Login shape (field/value on the entry)", () => {
    const events = parseCommentEvents({
      object: "instagram",
      entry: [
        {
          id: "17841400000000001",
          time: 1760000000,
          field: "comments",
          value: {
            id: "18000000000000001",
            from: { id: "900000001", username: "fan.account" },
            text: "send me the GUIDE",
            media: { id: "18100000000000001", media_product_type: "REELS" },
          },
        },
      ],
    })
    expect(events).toEqual([
      {
        igUserId: "17841400000000001",
        commentId: "18000000000000001",
        commenterId: "900000001",
        commenterUsername: "fan.account",
        text: "send me the GUIDE",
        mediaId: "18100000000000001",
        mediaProductType: "REELS",
        parentId: null,
      },
    ])
  })

  it("parses the changes[] shape with comment_id", () => {
    const events = parseCommentEvents({
      object: "instagram",
      entry: [
        {
          id: "17841400000000001",
          changes: [
            {
              field: "comments",
              value: {
                comment_id: "18000000000000002",
                parent_id: "18000000000000001",
                from: { id: "900000002", username: "other" },
                text: "link?",
                media: { id: "18100000000000001" },
              },
            },
          ],
        },
      ],
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      igUserId: "17841400000000001",
      commentId: "18000000000000002",
      parentId: "18000000000000001",
      mediaProductType: null,
    })
  })

  it("keeps 17 digit IDs exact when Meta sends them as JSON numbers", () => {
    // Written as raw JSON text: a JS number literal would already be rounded.
    const raw =
      '{"object":"instagram","entry":[{"id":17841400000000001,"field":"comments",' +
      '"value":{"id":18000000000000003,"from":{"id":900000000000000009,"username":"u"},' +
      '"text":"guide","media":{"id":18100000000000007}}}]}'
    // The naive parse really does corrupt these, which is the bug this guards.
    expect(String((JSON.parse(raw) as { entry: { id: number }[] }).entry[0]?.id)).not.toBe(
      "17841400000000001",
    )
    const [event] = parseCommentEvents(parseWebhookJson(raw))
    expect(event).toMatchObject({
      igUserId: "17841400000000001",
      commentId: "18000000000000003",
      commenterId: "900000000000000009",
      mediaId: "18100000000000007",
    })
  })

  it("leaves ordinary small numbers alone", () => {
    expect(parseWebhookJson('{"time":1760000000,"n":42}')).toEqual({ time: 1760000000, n: 42 })
  })

  it("throws on invalid JSON so the handler can reject it", () => {
    expect(() => parseWebhookJson("{not json")).toThrow()
  })

  it("ignores non comment fields and non instagram objects", () => {
    expect(
      parseCommentEvents({
        object: "instagram",
        entry: [{ id: "1", field: "mentions", value: { id: "2" } }],
      }),
    ).toEqual([])
    expect(parseCommentEvents({ object: "page", entry: [] })).toEqual([])
    expect(parseCommentEvents(null)).toEqual([])
    expect(parseCommentEvents("nope")).toEqual([])
  })

  it("skips malformed entries without dropping valid ones", () => {
    const events = parseCommentEvents({
      object: "instagram",
      entry: [
        { nonsense: true },
        { id: "1", field: "comments", value: { text: "no id here" } },
        { id: "1", field: "comments", value: { id: "c1", text: "ok" } },
      ],
    })
    expect(events.map((e) => e.commentId)).toEqual(["c1"])
  })

  it("treats a comment with no text as empty text, not a crash", () => {
    const [event] = parseCommentEvents({
      object: "instagram",
      entry: [{ id: "1", field: "comments", value: { id: "c1" } }],
    })
    expect(event?.text).toBe("")
  })
})
