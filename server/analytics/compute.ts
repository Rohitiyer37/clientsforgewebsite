import {
  FUNNEL_STAGE_KEYS,
  KPI_KEYS,
  REEL_SORT_KEYS,
  type DateRange,
  type FunnelDto,
  type FunnelLeakDto,
  type FunnelStageDto,
  type FunnelStageKey,
  type KpiDto,
  type KpiKey,
  type ReelDto,
  type ReelSortKey,
  type TopReelsDto,
} from "../../shared/analytics"
import type { Benchmark, FunnelStepKey } from "./benchmarks"
import { enumerateDates } from "./dates"

/**
 * All analytics aggregation lives here, as pure functions, so every number
 * the page shows can be tested. The UI only renders what this returns.
 *
 * The rule throughout: null means Instagram did not report it. Nulls are
 * never summed as 0, never divided by, and never shown as a number.
 */

export type DailyMetricKey =
  | "views"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "follows"
  | "unfollows"
  | "profile_visits"
  | "bio_link_taps"
  | "reach"
  | "follower_count"

export type DailyMetricsRow = { date: string } & Record<DailyMetricKey, number | null>

export type UnavailableReason =
  | "api_removed"
  | "min_followers"
  | "missing_permission"
  | "no_data"
  | "dm_tracking_off"

/** Why a metric cannot be shown. Stored per account by the sync engine. */
export type AvailabilityMap = Partial<Record<DailyMetricKey, UnavailableReason>>

export const UNAVAILABLE_TEXT: Record<UnavailableReason, string> = {
  api_removed:
    "Instagram stopped reporting account profile visits through its API in January 2025, so they can't be shown here.",
  min_followers: "Instagram only reports follows for accounts with 100+ followers.",
  missing_permission: "Reconnect Instagram and allow insights access to see this.",
  no_data: "Instagram hasn't reported this metric for these dates.",
  dm_tracking_off: "DM tracking isn't on yet. Reconnect Instagram to turn it on.",
}

const KPI_META: Record<KpiKey, { label: string; description: string }> = {
  views: {
    label: "Views",
    description: "Times your reels, posts and stories were played or shown.",
  },
  likes: { label: "Likes", description: "Likes on your posts, reels and videos." },
  comments: { label: "Comments", description: "Comments on your posts, reels and videos." },
  follows: {
    label: "Follows",
    description: "Accounts that followed you. Unfollows are not subtracted.",
  },
  profile_visits: { label: "Profile Visits", description: "Visits to your profile." },
  bio_link_taps: {
    label: "Contact Button Taps",
    description:
      "Taps on your call, email, text, directions and booking buttons. Instagram's API does not report bio link taps.",
  },
}

// ------------------------------------------------------------------ totals

export interface PeriodSum {
  total: number | null
  daysWithData: number
  days: number
}

/** Sums one metric over a date range, counting only reported days. */
export function sumMetric(
  rowsByDate: ReadonlyMap<string, DailyMetricsRow>,
  key: DailyMetricKey,
  range: { from: string; to: string },
): PeriodSum {
  const dates = enumerateDates(range.from, range.to)
  let total = 0
  let daysWithData = 0
  for (const date of dates) {
    const value = rowsByDate.get(date)?.[key]
    if (value === null || value === undefined) continue
    total += value
    daysWithData++
  }
  return { total: daysWithData > 0 ? total : null, daysWithData, days: dates.length }
}

/**
 * Percent change. Null (shown as "—") when either side is unknown or the
 * previous value is 0, so the page can never show "+∞%".
 */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

/** Ratio as a percent, or null when it cannot be computed honestly. */
export function ratioPct(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null
  return (numerator / denominator) * 100
}

export function indexRows(rows: readonly DailyMetricsRow[]): Map<string, DailyMetricsRow> {
  return new Map(rows.map((r) => [r.date, r]))
}

// -------------------------------------------------------------------- KPIs

export function buildKpis(input: {
  rows: readonly DailyMetricsRow[]
  range: DateRange
  previous: DateRange
  availability: AvailabilityMap
}): KpiDto[] {
  const byDate = indexRows(input.rows)
  const dates = enumerateDates(input.range.from, input.range.to)

  return KPI_KEYS.map((key): KpiDto => {
    const meta = KPI_META[key]
    const knownReason = input.availability[key]
    const current = sumMetric(byDate, key, input.range)
    const prev = sumMetric(byDate, key, input.previous)
    const series = dates.map((date) => ({ date, value: byDate.get(date)?.[key] ?? null }))

    const reason: UnavailableReason | null =
      knownReason ?? (current.daysWithData === 0 ? "no_data" : null)

    if (reason) {
      return {
        key,
        ...meta,
        available: false,
        unavailableReason: UNAVAILABLE_TEXT[reason],
        total: null,
        daysWithData: 0,
        days: current.days,
        previousTotal: null,
        deltaPct: null,
        deltaNote: null,
        series: dates.map((date) => ({ date, value: null })),
      }
    }

    // Only compare two complete periods. A partial one would make the change
    // look bigger or smaller than it really is.
    let deltaPct: number | null = null
    let deltaNote: string | null = null
    if (current.daysWithData < current.days) {
      deltaNote = "Some days in this period have no data yet, so it isn't compared."
    } else if (prev.daysWithData === 0) {
      deltaNote = "No data for the previous period."
    } else if (prev.daysWithData < prev.days) {
      deltaNote = "Not enough history to compare with the previous period."
    } else if (prev.total === 0) {
      deltaNote = "The previous period was 0, so a percent change can't be shown."
    } else {
      deltaPct = percentChange(current.total, prev.total)
    }

    return {
      key,
      ...meta,
      available: true,
      unavailableReason: null,
      total: current.total,
      daysWithData: current.daysWithData,
      days: current.days,
      previousTotal: prev.daysWithData === prev.days ? prev.total : null,
      deltaPct,
      deltaNote,
      series,
    }
  })
}

// ------------------------------------------------------------------- reels

export interface ReelInput extends ReelDto {
  productType: string | null
}

function compareReels(key: ReelSortKey) {
  return (a: ReelDto, b: ReelDto): number => {
    const av = a[key]
    const bv = b[key]
    // Unknown values sort last, never as if they were 0.
    if (av === null && bv !== null) return 1
    if (bv === null && av !== null) return -1
    if (av !== null && bv !== null && av !== bv) return bv - av
    return (b.postedAt ?? "").localeCompare(a.postedAt ?? "")
  }
}

/** The top reels per sort key, from reels posted in the period. */
export function rankReels(reels: readonly ReelInput[], limit = 3): TopReelsDto {
  const only = reels.filter((r) => r.productType === "REELS")
  const byKey = {} as Record<ReelSortKey, ReelDto[]>
  for (const key of REEL_SORT_KEYS) {
    byKey[key] = [...only]
      .sort(compareReels(key))
      .slice(0, limit)
      .map(({ productType: _productType, ...dto }) => dto)
  }
  return { reelsInPeriod: only.length, byKey }
}

// ------------------------------------------------------------------ funnel

export interface StageInput {
  value: number | null
  /** Set when the stage cannot be shown at all. */
  unavailableReason: string | null
}

export interface FunnelInput {
  views: StageInput
  profile_visits: StageInput
  follows: StageInput
  new_dms: StageInput & { split: { organic: number; automation: number } | null }
}

const STAGE_LABELS: Record<FunnelStageKey, string> = {
  views: "Views",
  profile_visits: "Profile Visits",
  follows: "Follows",
  new_dms: "New DMs",
}

function stageAvailable(s: StageInput): s is StageInput & { value: number } {
  return s.unavailableReason === null && s.value !== null
}

/**
 * Builds the four stage funnel. Each stage converts from the nearest stage
 * above it that Instagram reported, and that pairing is named in the label,
 * so a missing stage never produces a wrong percentage.
 */
export function buildFunnelStages(input: FunnelInput): FunnelStageDto[] {
  const top = stageAvailable(input.views) ? input.views.value : null
  const stages: FunnelStageDto[] = []
  let previous: { key: FunnelStageKey; value: number } | null = null

  for (const key of FUNNEL_STAGE_KEYS) {
    const stage = input[key]
    const available = stageAvailable(stage)
    const value = available ? stage.value : null

    let step: FunnelStageDto["step"] = null
    let dropOff: FunnelStageDto["dropOff"] = null
    if (available && previous) {
      step = {
        fromKey: previous.key,
        fromLabel: STAGE_LABELS[previous.key],
        pct: ratioPct(value, previous.value),
      }
      const lost = previous.value - (value as number)
      dropOff = { lost, pct: ratioPct(lost, previous.value) }
    }

    stages.push({
      key,
      label: STAGE_LABELS[key],
      value,
      available,
      unavailableReason: available
        ? null
        : stage.unavailableReason ?? UNAVAILABLE_TEXT.no_data,
      step,
      ofTopPct: key === "views" || !available ? null : ratioPct(value, top),
      dropOff,
      split: key === "new_dms" && available ? input.new_dms.split : null,
    })

    if (available) previous = { key, value: value as number }
  }
  return stages
}

/**
 * The step converting worst relative to its benchmark. Steps without a
 * benchmark, or whose conversion can't be computed, are not considered.
 */
export function detectLeak(
  stages: readonly FunnelStageDto[],
  benchmarks: Partial<Record<FunnelStepKey, Benchmark>>,
): FunnelLeakDto | null {
  let worst: { leak: FunnelLeakDto; score: number } | null = null
  for (const stage of stages) {
    if (!stage.step || stage.step.pct === null) continue
    const stepKey = `${stage.step.fromKey}->${stage.key}` as FunnelStepKey
    const benchmark = benchmarks[stepKey]
    if (!benchmark || benchmark.low <= 0) continue
    const score = stage.step.pct / benchmark.low
    if (worst && score >= worst.score) continue
    worst = {
      score,
      leak: {
        fromKey: stage.step.fromKey,
        toKey: stage.key,
        fromLabel: stage.step.fromLabel,
        toLabel: stage.label,
        pct: stage.step.pct,
        benchmarkLow: benchmark.low,
        benchmarkHigh: benchmark.high,
        belowBenchmark: stage.step.pct < benchmark.low,
        hint: benchmark.hint,
      },
    }
  }
  return worst?.leak ?? null
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-09-10" as "10 Sep 2026". Built by hand so it never varies by ICU version. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`
}

/** The note shown when DM tracking began inside the selected period. */
export function dmTrackingNote(
  trackingStartDate: string | null,
  range: { from: string; to: string },
): string | null {
  if (!trackingStartDate || trackingStartDate <= range.from) return null
  if (trackingStartDate > range.to) {
    return `DM tracking started on ${formatDay(trackingStartDate)}, after this period, so DMs in it may be missing.`
  }
  return `DM tracking started on ${formatDay(trackingStartDate)}, so earlier DMs may not be counted.`
}

export function buildFunnel(
  input: FunnelInput,
  benchmarks: Partial<Record<FunnelStepKey, Benchmark>>,
  opts: { trackingStartDate: string | null; range: { from: string; to: string } },
): FunnelDto {
  const stages = buildFunnelStages(input)
  return {
    stages,
    leak: detectLeak(stages, benchmarks),
    dmTrackingNote: stages.find((s) => s.key === "new_dms")?.available
      ? dmTrackingNote(opts.trackingStartDate, opts.range)
      : null,
  }
}

/** Turns a KPI into a funnel stage input. */
export function stageFromKpi(kpi: KpiDto | undefined): StageInput {
  if (!kpi) return { value: null, unavailableReason: UNAVAILABLE_TEXT.no_data }
  return kpi.available
    ? { value: kpi.total, unavailableReason: null }
    : { value: null, unavailableReason: kpi.unavailableReason }
}
