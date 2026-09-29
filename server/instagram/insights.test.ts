import { describe, expect, it } from "vitest"

import {
  parseAccountInsights,
  parseConversations,
  parseMediaInsights,
  parseUsageHeaders,
} from "./insights"
import { parseMessagingEvents } from "./webhook"

describe("parseAccountInsights", () => {
  it("reads total_value metrics", () => {
    const out = parseAccountInsights({
      data: [
        { name: "views", period: "day", total_value: { value: 1234 } },
        { name: "likes", period: "day", total_value: { value: 0 } },
      ],
    })
    expect(out.get("views")?.value).toBe(1234)
    expect(out.get("likes")?.value).toBe(0)
  })

  it("reads follow_type breakdowns", () => {
    const out = parseAccountInsights({
      data: [
        {
          name: "follows_and_unfollows",
          total_value: {
            breakdowns: [
              {
                dimension_keys: ["follow_type"],
                results: [
                  { dimension_values: ["FOLLOWER"], value: 12 },
                  { dimension_values: ["NON_FOLLOWER"], value: 3 },
                ],
              },
            ],
          },
        },
      ],
    })
    const metric = out.get("follows_and_unfollows")
    expect(metric?.value).toBeNull()
    expect(metric?.breakdown.get("FOLLOWER")).toBe(12)
    expect(metric?.breakdown.get("NON_FOLLOWER")).toBe(3)
  })

  it("leaves a metric Instagram omitted absent, never 0", () => {
    const out = parseAccountInsights({ data: [] })
    expect(out.get("views")).toBeUndefined()
    expect(parseAccountInsights({ nonsense: true }).size).toBe(0)
  })
})

describe("parseMediaInsights", () => {
  it("reads lifetime values and ignores non numbers", () => {
    const out = parseMediaInsights({
      data: [
        { name: "views", period: "lifetime", values: [{ value: 5000 }] },
        { name: "ig_reels_avg_watch_time", period: "lifetime", values: [{ value: 7421 }] },
        { name: "saved", values: [{ value: "n/a" }] },
      ],
    })
    expect(out.get("views")).toBe(5000)
    expect(out.get("ig_reels_avg_watch_time")).toBe(7421)
    expect(out.get("saved")).toBeNull()
  })
})

describe("parseConversations", () => {
  it("maps threads, message senders, and paging", () => {
    const out = parseConversations({
      data: [
        {
          id: "t1",
          updated_time: "2026-09-20T10:00:00+0000",
          participants: { data: [{ username: "me", id: "1" }, { username: "fan", id: "2" }] },
          messages: {
            data: [{ id: "m1", created_time: "2026-09-20T10:00:00+0000", from: { id: "2" } }],
            paging: { next: "https://graph.instagram.com/next" },
          },
        },
        { broken: true },
      ],
      paging: { cursors: { after: "CURSOR" }, next: "https://graph.instagram.com/page2" },
    })
    expect(out.nextCursor).toBe("CURSOR")
    expect(out.threads).toHaveLength(1)
    expect(out.threads[0]).toEqual({
      participants: [
        { id: "1", username: "me" },
        { id: "2", username: "fan" },
      ],
      messages: [{ createdTime: "2026-09-20T10:00:00+0000", fromId: "2" }],
      hasMoreMessages: true,
    })
  })

  it("has no cursor on the last page", () => {
    expect(parseConversations({ data: [], paging: { cursors: { after: "X" } } }).nextCursor).toBeNull()
  })
})

describe("parseUsageHeaders", () => {
  it("takes the highest percentage across both headers", () => {
    const headers = new Headers({
      "x-app-usage": JSON.stringify({ call_volume: 12, cpu_time: 4 }),
      "x-business-use-case-usage": JSON.stringify({
        "178414": [{ type: "instagram", call_count: 85, total_time: 10, estimated_time_to_regain_access: 0 }],
      }),
    })
    expect(parseUsageHeaders(headers)).toEqual({ maxPct: 85, regainAccessMinutes: 0 })
  })

  it("ignores missing and malformed headers", () => {
    expect(parseUsageHeaders(new Headers())).toEqual({ maxPct: null, regainAccessMinutes: null })
    expect(parseUsageHeaders(new Headers({ "x-app-usage": "{oops" })).maxPct).toBeNull()
  })
})

describe("parseMessagingEvents", () => {
  it("reads inbound messages and echoes without keeping their text", () => {
    const events = parseMessagingEvents({
      object: "instagram",
      entry: [
        {
          id: "17841457686704114",
          time: 1_790_000_000,
          messaging: [
            {
              sender: { id: "900001" },
              recipient: { id: "17841457686704114" },
              timestamp: 1_790_000_000_123,
              message: { mid: "m1", text: "private words" },
            },
            {
              sender: { id: "17841457686704114" },
              recipient: { id: "900001" },
              timestamp: 1_790_000_000,
              message: { mid: "m2", text: "reply", is_echo: true },
            },
            { sender: { id: "900001" }, recipient: { id: "1" }, timestamp: 1, read: { mid: "m1" } },
          ],
        },
      ],
    })
    expect(events).toHaveLength(3)
    expect(events[0]).toEqual({
      igUserId: "17841457686704114",
      senderId: "900001",
      recipientId: "17841457686704114",
      timestampMs: 1_790_000_000_123,
      hasMessage: true,
      isEcho: false,
      isDeleted: false,
    })
    // Seconds are converted to milliseconds.
    expect(events[1]?.timestampMs).toBe(1_790_000_000_000)
    expect(events[1]?.isEcho).toBe(true)
    expect(events[2]?.hasMessage).toBe(false)
    expect(JSON.stringify(events)).not.toContain("private words")
  })

  it("accepts the field/value shape and ignores other objects", () => {
    expect(
      parseMessagingEvents({
        object: "instagram",
        entry: [{ id: "1", field: "messages", value: { sender: { id: "2" }, message: { mid: "x" } } }],
      }),
    ).toHaveLength(1)
    expect(parseMessagingEvents({ object: "page", entry: [] })).toEqual([])
  })
})
