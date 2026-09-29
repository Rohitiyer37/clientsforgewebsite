import { describe, expect, it } from "vitest"

import {
  classifyBackfillThread,
  classifyMessagingEvent,
  earliestInboundPerSender,
  isAutomationAttributed,
  newConversations,
  type MessagingEvent,
} from "./dm"

const ACCOUNT = "17841457686704114"
const SCOPED = "28924430267244757"
const received = new Date("2026-09-28T10:00:00Z")

function event(overrides: Partial<MessagingEvent> = {}): MessagingEvent {
  return {
    igUserId: ACCOUNT,
    senderId: "900001",
    recipientId: ACCOUNT,
    timestampMs: Date.parse("2026-09-28T09:59:00Z"),
    hasMessage: true,
    isEcho: false,
    isDeleted: false,
    ...overrides,
  }
}

describe("classifyMessagingEvent", () => {
  it("accepts an inbound message from another person", () => {
    expect(classifyMessagingEvent(event(), [SCOPED], received)).toEqual({
      kind: "inbound",
      igUserId: ACCOUNT,
      senderId: "900001",
      at: new Date("2026-09-28T09:59:00Z"),
    })
  })

  it("ignores echoes of messages the account sent", () => {
    expect(
      classifyMessagingEvent(event({ isEcho: true, senderId: ACCOUNT }), [SCOPED], received),
    ).toEqual({ kind: "ignore", reason: "echo" })
  })

  it("ignores messages from the account's own IDs even without the echo flag", () => {
    expect(classifyMessagingEvent(event({ senderId: ACCOUNT }), [SCOPED], received)).toEqual({
      kind: "ignore",
      reason: "own_account",
    })
    expect(classifyMessagingEvent(event({ senderId: SCOPED }), [SCOPED], received)).toEqual({
      kind: "ignore",
      reason: "own_account",
    })
  })

  it("ignores read receipts, reactions, deletions, and events without a sender", () => {
    expect(classifyMessagingEvent(event({ hasMessage: false }), [], received).kind).toBe("ignore")
    expect(classifyMessagingEvent(event({ isDeleted: true }), [], received)).toEqual({
      kind: "ignore",
      reason: "deleted",
    })
    expect(classifyMessagingEvent(event({ senderId: null }), [], received)).toEqual({
      kind: "ignore",
      reason: "missing_sender",
    })
  })

  it("falls back to the receive time when the event has no timestamp", () => {
    const d = classifyMessagingEvent(event({ timestampMs: null }), [], received)
    expect(d.kind === "inbound" && d.at).toEqual(received)
  })
})

describe("repeat senders", () => {
  it("keeps only each sender's earliest message within a batch", () => {
    const decisions = [
      classifyMessagingEvent(event({ timestampMs: 3000 }), [], received),
      classifyMessagingEvent(event({ timestampMs: 1000 }), [], received),
      classifyMessagingEvent(event({ senderId: "900002", timestampMs: 2000 }), [], received),
      classifyMessagingEvent(event({ isEcho: true }), [], received),
    ]
    const out = earliestInboundPerSender(decisions)
    expect(out).toHaveLength(2)
    expect(out.find((o) => o.senderId === "900001")?.at).toEqual(new Date(1000))
  })

  it("counts a sender as new only the first time", () => {
    const inbound = [
      { senderId: "a", at: new Date(3) },
      { senderId: "b", at: new Date(2) },
      { senderId: "a", at: new Date(1) },
      { senderId: "c", at: new Date(4) },
    ]
    const out = newConversations(inbound, new Set(["c"]))
    expect(out).toEqual([
      { senderId: "a", at: new Date(1) },
      { senderId: "b", at: new Date(2) },
    ])
  })
})

describe("isAutomationAttributed", () => {
  const first = new Date("2026-09-28T10:00:00Z")

  it("attributes when an automation DM went out at or before the first message", () => {
    expect(isAutomationAttributed(first, [new Date("2026-09-28T09:00:00Z")])).toBe(true)
    expect(isAutomationAttributed(first, [first])).toBe(true)
  })

  it("does not attribute when the automation DM came later or never", () => {
    expect(isAutomationAttributed(first, [new Date("2026-09-28T11:00:00Z")])).toBe(false)
    expect(isAutomationAttributed(first, [null])).toBe(false)
    expect(isAutomationAttributed(first, [])).toBe(false)
  })
})

describe("classifyBackfillThread", () => {
  const participants = [
    { id: ACCOUNT, username: "rohittiyerr" },
    { id: "900001", username: "fan" },
  ]

  it("finds the first inbound message when the whole thread is visible", () => {
    const decision = classifyBackfillThread(
      {
        participants,
        hasMoreMessages: false,
        messages: [
          { createdTime: "2026-09-20T10:00:00+0000", fromId: "900001" },
          { createdTime: "2026-09-19T10:00:00+0000", fromId: ACCOUNT },
          { createdTime: "2026-09-18T10:00:00+0000", fromId: "900001" },
        ],
      },
      [ACCOUNT, SCOPED],
      "rohittiyerr",
    )
    expect(decision).toEqual({
      kind: "conversation",
      threadKey: "900001",
      firstInboundAt: new Date("2026-09-18T10:00:00Z"),
    })
  })

  it("skips a thread where the other person never replied", () => {
    expect(
      classifyBackfillThread(
        {
          participants,
          hasMoreMessages: false,
          messages: [{ createdTime: "2026-09-18T10:00:00+0000", fromId: ACCOUNT }],
        },
        [ACCOUNT],
        null,
      ),
    ).toEqual({ kind: "skip", reason: "never_messaged" })
  })

  it("records a known sender with no time when older messages are hidden", () => {
    expect(
      classifyBackfillThread(
        {
          participants,
          hasMoreMessages: true,
          messages: [{ createdTime: "2026-09-20T10:00:00+0000", fromId: "900001" }],
        },
        [ACCOUNT],
        null,
      ),
    ).toEqual({ kind: "conversation", threadKey: "900001", firstInboundAt: null })
  })

  it("matches the account by username when its ID differs", () => {
    expect(
      classifyBackfillThread(
        { participants: [{ id: "other-id", username: "rohittiyerr" }], hasMoreMessages: false, messages: [] },
        [ACCOUNT],
        "rohittiyerr",
      ),
    ).toEqual({ kind: "skip", reason: "no_other_participant" })
  })
})
