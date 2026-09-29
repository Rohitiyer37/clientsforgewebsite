import { describe, expect, it } from "vitest"

import { parseAccountInsights, parseMediaInsights, parseUsageHeaders } from "./insights"

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
