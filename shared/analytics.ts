import { z } from "zod"

/**
 * The contract between GET /api/analytics/instagram and the analytics page.
 * Every number here comes from Instagram's API or from data we stored. A null
 * always means "not available" and is shown as such, never as 0.
 */

export const RANGE_PRESETS = ["7d", "14d", "30d", "90d"] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]
export const DEFAULT_RANGE: RangePreset = "30d"
export const PRESET_DAYS: Record<RangePreset, number> = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 }
/** Longest custom range accepted, in days. */
export const MAX_CUSTOM_RANGE_DAYS = 400

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
  }, "Not a real date")

export const AnalyticsQuerySchema = z
  .object({
    range: z.enum(RANGE_PRESETS).optional(),
    from: IsoDate.optional(),
    to: IsoDate.optional(),
  })
  .refine((q) => (q.from === undefined) === (q.to === undefined), {
    message: "Send both from and to, or neither",
  })
  .refine((q) => !(q.range && q.from), { message: "Send a preset range or custom dates, not both" })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: "from must be on or before to" })

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>

export const KPI_KEYS = [
  "views",
  "likes",
  "comments",
  "follows",
  "profile_visits",
  "bio_link_taps",
] as const
export type KpiKey = (typeof KPI_KEYS)[number]

export const REEL_SORT_KEYS = ["views", "likes", "comments", "shares", "saves"] as const
export type ReelSortKey = (typeof REEL_SORT_KEYS)[number]

export const FUNNEL_STAGE_KEYS = ["views", "profile_visits", "follows", "new_dms"] as const
export type FunnelStageKey = (typeof FUNNEL_STAGE_KEYS)[number]

export interface DateRange {
  from: string
  to: string
  days: number
}

export interface SeriesPoint {
  date: string
  value: number | null
}

export interface KpiDto {
  key: KpiKey
  label: string
  /** Shown under the label so a renamed metric is never mistaken for another. */
  description: string
  available: boolean
  unavailableReason: string | null
  total: number | null
  /** Days in the period with a reported value, out of `days`. */
  daysWithData: number
  days: number
  previousTotal: number | null
  /** Percent change vs the previous period. Null renders as "—". */
  deltaPct: number | null
  deltaNote: string | null
  series: SeriesPoint[]
}

export interface ReelDto {
  mediaId: string
  caption: string | null
  permalink: string | null
  thumbnailUrl: string | null
  postedAt: string | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  avgWatchTimeMs: number | null
  insightsFetchedAt: string | null
}

export interface TopReelsDto {
  reelsInPeriod: number
  byKey: Record<ReelSortKey, ReelDto[]>
}

export interface FunnelStageDto {
  key: FunnelStageKey
  label: string
  value: number | null
  available: boolean
  unavailableReason: string | null
  /** Conversion from the nearest available stage above this one. */
  step: { fromKey: FunnelStageKey; fromLabel: string; pct: number | null } | null
  /** This stage divided by Views. */
  ofTopPct: number | null
  /** Change from the nearest available stage above. Negative lost means a gain. */
  dropOff: { lost: number; pct: number | null } | null
  split: { organic: number; automation: number } | null
}

export interface FunnelLeakDto {
  fromKey: FunnelStageKey
  toKey: FunnelStageKey
  fromLabel: string
  toLabel: string
  pct: number
  benchmarkLow: number
  benchmarkHigh: number
  belowBenchmark: boolean
  hint: string
}

export interface FunnelDto {
  stages: FunnelStageDto[]
  leak: FunnelLeakDto | null
  dmTrackingNote: string | null
}

export type Section<T> = { ok: true; data: T } | { ok: false; error: string }

export type SyncState =
  | "not_connected"
  | "expired"
  | "missing_permission"
  | "first_sync"
  | "ready"

export interface SyncStatusDto {
  state: SyncState
  running: boolean
  lastSyncedAt: string | null
  backfillComplete: boolean
  /** When the Refresh button unlocks again, if it is throttled. */
  refreshAvailableAt: string | null
  lastError: string | null
}

export interface AnalyticsAccountDto {
  username: string
  profilePictureUrl: string | null
}

export interface AnalyticsResponse {
  account: AnalyticsAccountDto | null
  sync: SyncStatusDto
  timezone: string
  /** Null until at least one day has been stored. */
  availableRange: { min: string; max: string } | null
  range: (DateRange & { preset: RangePreset | null }) | null
  previousRange: DateRange | null
  dayBoundaryNote: string | null
  dmTrackingStartedAt: string | null
  kpis: Section<KpiDto[]>
  topReels: Section<TopReelsDto>
  funnel: Section<FunnelDto>
}
