import { describe, expect, it } from "vitest"

import {
  PRIVATE_REPLY_WINDOW_MS,
  isSelfComment,
  isWithinReplyWindow,
  pickReply,
  selectAutomation,
  type TriggerCandidate,
} from "./rules"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const NOW = new Date("2026-09-26T12:00:00Z")
const ago = (ms: number) => new Date(NOW.getTime() - ms)

describe("7 day private reply window", () => {
  it("allows a comment from just now", () => {
    expect(isWithinReplyWindow(NOW, NOW)).toBe(true)
  })

  it("allows a comment 6 days and 23 hours old", () => {
    expect(isWithinReplyWindow(ago(6 * DAY + 23 * HOUR), NOW)).toBe(true)
  })

  it("allows a comment one second inside the window", () => {
    expect(isWithinReplyWindow(ago(PRIVATE_REPLY_WINDOW_MS - 1000), NOW)).toBe(true)
  })

  it("rejects a comment exactly 7 days old", () => {
    expect(isWithinReplyWindow(ago(PRIVATE_REPLY_WINDOW_MS), NOW)).toBe(false)
  })

  it("rejects a comment older than 7 days", () => {
    expect(isWithinReplyWindow(ago(8 * DAY), NOW)).toBe(false)
    expect(isWithinReplyWindow(ago(365 * DAY), NOW)).toBe(false)
  })

  it("treats a slightly future timestamp (clock skew) as inside the window", () => {
    expect(isWithinReplyWindow(new Date(NOW.getTime() + 30_000), NOW)).toBe(true)
  })
})

describe("self comment skip", () => {
  const account = { igUserId: "17841400000000001", igScopedId: "26000000000001", username: "clientsforge" }

  it("skips a comment from the professional account ID", () => {
    expect(isSelfComment({ commenterId: "17841400000000001", commenterUsername: null }, account)).toBe(true)
  })

  it("skips a comment from the app scoped ID", () => {
    expect(isSelfComment({ commenterId: "26000000000001", commenterUsername: null }, account)).toBe(true)
  })

  it("skips a comment matching the username, case insensitively", () => {
    expect(isSelfComment({ commenterId: null, commenterUsername: "ClientsForge" }, account)).toBe(true)
  })

  it("does not skip a real commenter", () => {
    expect(isSelfComment({ commenterId: "900000001", commenterUsername: "a.fan" }, account)).toBe(false)
  })

  it("does not skip when the webhook carried no identity", () => {
    expect(isSelfComment({ commenterId: null, commenterUsername: null }, account)).toBe(false)
  })

  it("does not skip a lookalike username", () => {
    expect(isSelfComment({ commenterId: "9", commenterUsername: "clientsforge_" }, account)).toBe(false)
  })

  it("handles an account with no scoped ID stored", () => {
    const noScoped = { ...account, igScopedId: null }
    expect(isSelfComment({ commenterId: "26000000000001", commenterUsername: "x" }, noScoped)).toBe(false)
  })
})

describe("automation selection", () => {
  const base: TriggerCandidate = {
    id: "b",
    isActive: true,
    mediaId: "m1",
    triggerType: "keywords",
    keywords: ["guide"],
  }

  it("picks the automation on the right post whose keyword matches", () => {
    expect(selectAutomation([base], "m1", "send the GUIDE!")?.id).toBe("b")
  })

  it("returns null when the keyword does not match", () => {
    expect(selectAutomation([base], "m1", "nice reel")).toBeNull()
  })

  it("ignores automations on other posts", () => {
    expect(selectAutomation([base], "m2", "guide")).toBeNull()
  })

  it("ignores paused automations", () => {
    expect(selectAutomation([{ ...base, isActive: false }], "m1", "guide")).toBeNull()
  })

  it("returns null when the comment has no media", () => {
    expect(selectAutomation([base], null, "guide")).toBeNull()
  })

  it("prefers a keyword automation over any comment when both match", () => {
    const any: TriggerCandidate = { ...base, id: "a", triggerType: "any_comment", keywords: [] }
    expect(selectAutomation([any, base], "m1", "guide please")?.id).toBe("b")
    expect(selectAutomation([any, base], "m1", "nice")?.id).toBe("a")
  })
})

describe("public reply variants", () => {
  it("returns null when there are no usable replies", () => {
    expect(pickReply([])).toBeNull()
    expect(pickReply(["", "   "])).toBeNull()
  })

  it("picks each variant for the matching random value, never out of range", () => {
    const replies = ["one", "two", "three"]
    expect(pickReply(replies, () => 0)).toBe("one")
    expect(pickReply(replies, () => 0.5)).toBe("two")
    expect(pickReply(replies, () => 0.999999)).toBe("three")
    expect(pickReply(replies, () => 1)).toBe("three")
  })

  it("eventually uses every variant", () => {
    const seen = new Set(Array.from({ length: 300 }, () => pickReply(["a", "b", "c"])))
    expect(seen).toEqual(new Set(["a", "b", "c"]))
  })
})
