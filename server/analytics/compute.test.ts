import { describe, expect, it } from "vitest"

import type { KpiDto } from "../../shared/analytics"
import type { Benchmark, FunnelStepKey } from "./benchmarks"
import {
  UNAVAILABLE_TEXT,
  buildFunnel,
  buildFunnelStages,
  buildKpis,
  detectLeak,
  dmTrackingNote,
  indexRows,
  percentChange,
  rankReels,
  ratioPct,
  stageFromKpi,
  sumMetric,
  type DailyMetricsRow,
  type FunnelInput,
  type ReelInput,
} from "./compute"
import { enumerateDates } from "./dates"

function row(date: string, values: Partial<DailyMetricsRow> = {}): DailyMetricsRow {
  return {
    date,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    follows: null,
    unfollows: null,
    profile_visits: null,
    bio_link_taps: null,
    reach: null,
    follower_count: null,
    ...values,
  }
}

function fullRows(from: string, to: string, values: Partial<DailyMetricsRow>) {
  return enumerateDates(from, to).map((d) => row(d, values))
}

describe("percentChange", () => {
  it("computes the change against the previous value", () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
    expect(percentChange(100, 100)).toBe(0)
  })

  it("returns null instead of infinity when the previous value is 0", () => {
    expect(percentChange(10, 0)).toBeNull()
    expect(percentChange(0, 0)).toBeNull()
  })

  it("returns null when either side is unknown", () => {
    expect(percentChange(null, 100)).toBeNull()
    expect(percentChange(100, null)).toBeNull()
  })
})

describe("ratioPct", () => {
  it("never divides by zero or null", () => {
    expect(ratioPct(5, 0)).toBeNull()
    expect(ratioPct(5, null)).toBeNull()
    expect(ratioPct(null, 10)).toBeNull()
    expect(ratioPct(1, 4)).toBe(25)
  })
})

describe("sumMetric", () => {
  it("counts only reported days and keeps 0 as a real value", () => {
    const rows = indexRows([
      row("2026-09-01", { views: 10 }),
      row("2026-09-02", { views: 0 }),
      row("2026-09-03", { views: null }),
    ])
    expect(sumMetric(rows, "views", { from: "2026-09-01", to: "2026-09-04" })).toEqual({
      total: 10,
      daysWithData: 2,
      days: 4,
    })
  })

  it("is null, not 0, when no day was reported", () => {
    const rows = indexRows([row("2026-09-01")])
    expect(sumMetric(rows, "views", { from: "2026-09-01", to: "2026-09-01" }).total).toBeNull()
  })
})

describe("buildKpis", () => {
  const range = { from: "2026-09-08", to: "2026-09-14", days: 7 }
  const previous = { from: "2026-09-01", to: "2026-09-07", days: 7 }

  function kpi(kpis: KpiDto[], key: KpiDto["key"]): KpiDto {
    const found = kpis.find((k) => k.key === key)
    if (!found) throw new Error(`missing ${key}`)
    return found
  }

  it("totals the period and compares with a complete previous period", () => {
    const rows = [
      ...fullRows("2026-09-01", "2026-09-07", { views: 10, likes: 2 }),
      ...fullRows("2026-09-08", "2026-09-14", { views: 20, likes: 1 }),
    ]
    const kpis = buildKpis({ rows, range, previous, availability: {} })
    const views = kpi(kpis, "views")
    expect(views.total).toBe(140)
    expect(views.previousTotal).toBe(70)
    expect(views.deltaPct).toBe(100)
    expect(views.series).toHaveLength(7)
    expect(kpi(kpis, "likes").deltaPct).toBe(-50)
  })

  it("shows no delta when the previous period has no data", () => {
    const rows = fullRows("2026-09-08", "2026-09-14", { views: 20 })
    const views = kpi(buildKpis({ rows, range, previous, availability: {} }), "views")
    expect(views.total).toBe(140)
    expect(views.deltaPct).toBeNull()
    expect(views.deltaNote).toBe("No data for the previous period.")
  })

  it("shows no delta when the previous period was 0", () => {
    const rows = [
      ...fullRows("2026-09-01", "2026-09-07", { views: 0 }),
      ...fullRows("2026-09-08", "2026-09-14", { views: 5 }),
    ]
    const views = kpi(buildKpis({ rows, range, previous, availability: {} }), "views")
    expect(views.previousTotal).toBe(0)
    expect(views.deltaPct).toBeNull()
  })

  it("refuses to compare against a partial previous period", () => {
    const rows = [
      ...fullRows("2026-09-05", "2026-09-07", { views: 10 }),
      ...fullRows("2026-09-08", "2026-09-14", { views: 10 }),
    ]
    const views = kpi(buildKpis({ rows, range, previous, availability: {} }), "views")
    expect(views.deltaPct).toBeNull()
    expect(views.previousTotal).toBeNull()
    expect(views.deltaNote).toMatch(/Not enough history/)
  })

  it("marks a metric unavailable with its reason and never shows 0", () => {
    const rows = fullRows("2026-09-08", "2026-09-14", { views: 5, follows: null })
    const kpis = buildKpis({
      rows,
      range,
      previous,
      availability: { follows: "min_followers", profile_visits: "api_removed" },
    })
    const follows = kpi(kpis, "follows")
    expect(follows.available).toBe(false)
    expect(follows.total).toBeNull()
    expect(follows.unavailableReason).toBe(UNAVAILABLE_TEXT.min_followers)
    expect(follows.series.every((p) => p.value === null)).toBe(true)
    expect(kpi(kpis, "profile_visits").unavailableReason).toBe(UNAVAILABLE_TEXT.api_removed)
  })

  it("treats a metric with no reported day as unavailable", () => {
    const rows = fullRows("2026-09-08", "2026-09-14", { views: 5 })
    const likes = kpi(buildKpis({ rows, range, previous, availability: {} }), "likes")
    expect(likes.available).toBe(false)
    expect(likes.unavailableReason).toBe(UNAVAILABLE_TEXT.no_data)
  })

  it("labels contact button taps accurately", () => {
    const rows = fullRows("2026-09-08", "2026-09-14", { bio_link_taps: 1 })
    const taps = kpi(buildKpis({ rows, range, previous, availability: {} }), "bio_link_taps")
    expect(taps.label).toBe("Contact Button Taps")
    expect(taps.description).toMatch(/does not report bio link taps/)
  })
})

describe("rankReels", () => {
  const base: Omit<ReelInput, "mediaId" | "views" | "likes" | "postedAt"> = {
    caption: null,
    permalink: null,
    thumbnailUrl: null,
    comments: null,
    shares: null,
    saves: null,
    avgWatchTimeMs: null,
    insightsFetchedAt: null,
    productType: "REELS",
  }

  it("ranks reels per metric, puts unknown values last, and skips non reels", () => {
    const reels: ReelInput[] = [
      { ...base, mediaId: "a", views: 100, likes: 1, postedAt: "2026-09-01T00:00:00Z" },
      { ...base, mediaId: "b", views: null, likes: 50, postedAt: "2026-09-02T00:00:00Z" },
      { ...base, mediaId: "c", views: 300, likes: 5, postedAt: "2026-09-03T00:00:00Z" },
      { ...base, mediaId: "d", views: 200, likes: 0, postedAt: "2026-09-04T00:00:00Z" },
      { ...base, mediaId: "e", views: 999, likes: 999, postedAt: "2026-09-05T00:00:00Z", productType: "FEED" },
    ]
    const top = rankReels(reels)
    expect(top.reelsInPeriod).toBe(4)
    expect(top.byKey.views.map((r) => r.mediaId)).toEqual(["c", "d", "a"])
    expect(top.byKey.likes.map((r) => r.mediaId)).toEqual(["b", "c", "a"])
    expect(top.byKey.views[0]).not.toHaveProperty("productType")
  })

  it("returns what exists when fewer than 3 reels were posted", () => {
    const top = rankReels([{ ...base, mediaId: "a", views: 1, likes: 1, postedAt: null }])
    expect(top.byKey.views).toHaveLength(1)
    expect(rankReels([]).byKey.views).toHaveLength(0)
  })
})

describe("funnel", () => {
  const benchmarks: Partial<Record<FunnelStepKey, Benchmark>> = {
    "views->profile_visits": { low: 1, high: 3, hint: "curiosity" },
    "profile_visits->follows": { low: 8, high: 20, hint: "bio" },
    "follows->new_dms": { low: 5, high: 15, hint: "dm" },
    "views->follows": { low: 0.1, high: 0.5, hint: "follow cta" },
  }

  const all: FunnelInput = {
    views: { value: 10000, unavailableReason: null },
    profile_visits: { value: 60, unavailableReason: null },
    follows: { value: 12, unavailableReason: null },
    new_dms: { value: 3, unavailableReason: null, split: { organic: 2, automation: 1 } },
  }

  it("computes step conversion, share of top, and drop off", () => {
    const [views, visits, follows, dms] = buildFunnelStages(all)
    expect(views?.step).toBeNull()
    expect(views?.ofTopPct).toBeNull()
    expect(visits?.step).toEqual({ fromKey: "views", fromLabel: "Views", pct: 0.6 })
    expect(visits?.ofTopPct).toBe(0.6)
    expect(visits?.dropOff).toEqual({ lost: 9940, pct: 99.4 })
    expect(follows?.step?.pct).toBe(20)
    expect(follows?.ofTopPct).toBeCloseTo(0.12)
    expect(dms?.step?.pct).toBe(25)
    expect(dms?.split).toEqual({ organic: 2, automation: 1 })
  })

  it("flags the step furthest below its benchmark", () => {
    const leak = detectLeak(buildFunnelStages(all), benchmarks)
    expect(leak).toMatchObject({
      fromKey: "views",
      toKey: "profile_visits",
      pct: 0.6,
      belowBenchmark: true,
      hint: "curiosity",
    })
  })

  it("reports the weakest step even when every step is healthy", () => {
    const healthy: FunnelInput = {
      ...all,
      profile_visits: { value: 500, unavailableReason: null },
      follows: { value: 60, unavailableReason: null },
      new_dms: { value: 30, unavailableReason: null, split: { organic: 30, automation: 0 } },
    }
    const leak = detectLeak(buildFunnelStages(healthy), benchmarks)
    expect(leak?.toKey).toBe("follows")
    expect(leak?.belowBenchmark).toBe(false)
  })

  it("skips an unavailable stage and converts from the one above it", () => {
    const input: FunnelInput = {
      ...all,
      profile_visits: { value: null, unavailableReason: "removed" },
    }
    const [, visits, follows] = buildFunnelStages(input)
    expect(visits?.available).toBe(false)
    expect(visits?.unavailableReason).toBe("removed")
    expect(visits?.step).toBeNull()
    expect(visits?.ofTopPct).toBeNull()
    expect(follows?.step).toEqual({ fromKey: "views", fromLabel: "Views", pct: 0.12 })
    expect(detectLeak(buildFunnelStages(input), benchmarks)?.toKey).not.toBe("profile_visits")
  })

  it("does not divide by a zero stage", () => {
    const input: FunnelInput = {
      ...all,
      views: { value: 0, unavailableReason: null },
      profile_visits: { value: 0, unavailableReason: null },
    }
    const [, visits, follows] = buildFunnelStages(input)
    expect(visits?.step?.pct).toBeNull()
    expect(visits?.ofTopPct).toBeNull()
    expect(visits?.dropOff).toEqual({ lost: 0, pct: null })
    expect(follows?.step?.pct).toBeNull()
    expect(detectLeak(buildFunnelStages(input), {})).toBeNull()
  })

  it("treats a stage with no value as unavailable", () => {
    const [views] = buildFunnelStages({ ...all, views: { value: null, unavailableReason: null } })
    expect(views?.available).toBe(false)
    expect(views?.unavailableReason).toBe(UNAVAILABLE_TEXT.no_data)
  })

  it("adds the DM tracking note only when tracking began inside the period", () => {
    const range = { from: "2026-09-01", to: "2026-09-30" }
    expect(dmTrackingNote("2026-09-10", range)).toBe(
      "DM tracking started on 10 Sep 2026, so earlier DMs may not be counted.",
    )
    expect(dmTrackingNote("2026-08-01", range)).toBeNull()
    expect(dmTrackingNote("2026-09-01", range)).toBeNull()
    expect(dmTrackingNote(null, range)).toBeNull()
    const funnel = buildFunnel(all, benchmarks, { trackingStartDate: "2026-09-10", range })
    expect(funnel.dmTrackingNote).toMatch(/10 Sep 2026/)
  })

  it("maps KPIs to stage inputs", () => {
    expect(stageFromKpi(undefined).value).toBeNull()
    const unavailable = { available: false, total: null, unavailableReason: "why" } as KpiDto
    expect(stageFromKpi(unavailable)).toEqual({ value: null, unavailableReason: "why" })
  })
})
