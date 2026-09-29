import { addDays, dateInZone, enumerateDates, META_TIMEZONE, metaDayWindow } from "../analytics/dates"
import type { UnavailableReason } from "../analytics/compute"
import type { Db } from "../db"
import type { Insert, Json, Row } from "../database.types"
import { log } from "../log"
import { decryptAccountToken, instagramClient, markAccountExpired } from "./accounts"
import type { InstagramClient } from "./client"
import { MetaApiError, describeMetaError } from "./errors"
import type { AccountMetricValue, ApiUsage } from "./insights"

/**
 * Pulls Instagram insights into our tables so the analytics page never waits
 * on the Graph API and can show more history than Meta keeps.
 *
 * A run does as much as it can inside a deadline and records what is left:
 * days without fetched_at, and reels whose insights are stale. The next run picks up exactly there, so a long first backfill simply
 * spans a few runs. One failed metric never fails the run: the error is
 * recorded and the rest carries on.
 */

// Meta keeps account level insights for 90 days (Insights guide: "User
// Metrics data is stored for up to 90 days").
export const BACKFILL_DAYS = 90
/** Meta revises recent days, so these are fetched again on every run. */
export const RECENT_REFETCH_DAYS = 3
export const REEL_RECENT_DAYS = 90
const REEL_STALE_MS = 7 * 24 * 60 * 60 * 1000
const LEGACY_PROBE_MS = 7 * 24 * 60 * 60 * 1000
const MIN_FOLLOWERS_FOR_FOLLOWS = 100
const CONCURRENCY = 4
/** Stop starting new requests once Meta reports this much of the quota used. */
const USAGE_BACKOFF_PCT = 80
const MAX_MEDIA_PAGES = 20
const DEFAULT_DEADLINE_MS = 45_000
/**
 * Budget for a run inside a Netlify background function (15 minute hard
 * limit). Well short of it, so the run always closes itself cleanly.
 */
export const BACKGROUND_DEADLINE_MS = 10 * 60 * 1000
/** A run still "running" after this long was killed and is treated as failed. */
export const STALE_RUN_MS = 12 * 60 * 1000
/** A client can trigger a sync once per 15 minutes per account. */
export const REFRESH_INTERVAL_SECONDS = 15 * 60
/** While the first backfill is still running, continuation runs may follow closely. */
export const CONTINUATION_INTERVAL_SECONDS = 60

/** Day metrics requested together (all accept metric_type=total_value, no breakdown). */
const DAY_TOTAL_METRICS = {
  views: "views",
  reach: "reach",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saves",
} as const
const FOLLOWS_METRIC = "follows_and_unfollows"
/**
 * Metrics Meta's current reference no longer lists but the API still serves
 * (verified live on v25.0 and v26.0, 29 September 2026). Each is probed
 * weekly and fetched in its own request, so if Meta switches one off it
 * shows as "Not available" instead of breaking the other metrics.
 */
const LEGACY_METRICS = {
  profile_visits: "profile_views",
  bio_link_taps: "website_clicks",
} as const
type LegacyColumn = keyof typeof LEGACY_METRICS

/** Lifetime reel metrics. Units per Meta's media insights reference. */
const REEL_METRICS = {
  views: "views",
  reach: "reach",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saved",
  total_interactions: "total_interactions",
  avg_watch_time_ms: "ig_reels_avg_watch_time",
} as const

export type SyncTrigger = "cron" | "manual" | "connect" | "continuation"

export type StartResult =
  | { outcome: "started"; runId: string }
  | { outcome: "busy" }
  | { outcome: "throttled"; retryAfterSeconds: number }

type StateRow = Row<"ig_analytics_state">
type DailyInsert = Insert<"ig_account_daily_metrics">

interface Availability {
  reason: UnavailableReason | null
  checkedAt: string
}
type AvailabilityState = Record<string, Availability>

export interface SyncSummary {
  status: "succeeded" | "partial" | "failed"
  apiCalls: number
  daysFetched: number
  daysRemaining: number
  reelsFetched: number
  errors: string[]
}

class StopSync extends Error {
  constructor(
    readonly reason: "token" | "rate_limit",
    message: string,
  ) {
    super(message)
    this.name = "StopSync"
  }
}

/** Starts a run through the database lock, honouring the throttle. */
export async function startSyncRun(
  database: Db,
  accountId: string,
  trigger: SyncTrigger,
  minIntervalSeconds: number | null,
): Promise<StartResult> {
  const { data, error } = await database.rpc("start_ig_sync_run", {
    p_account_id: accountId,
    p_trigger: trigger,
    p_min_interval: minIntervalSeconds === null ? null : `${minIntervalSeconds} seconds`,
  })
  if (error) throw new Error(`Could not start sync: ${error.message}`)
  const row = data?.[0]
  if (row?.outcome === "started" && row.run_id) return { outcome: "started", runId: row.run_id }
  if (row?.outcome === "throttled") {
    return { outcome: "throttled", retryAfterSeconds: row.retry_after_seconds ?? 60 }
  }
  return { outcome: "busy" }
}

/** Runs a small pool of tasks, stopping new ones once `shouldStop` says so. */
async function pool<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  shouldStop: () => boolean,
): Promise<void> {
  let next = 0
  const lanes = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next++] as T
      await worker(item)
    }
  })
  await Promise.all(lanes)
}

function readAvailability(json: Json): AvailabilityState {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {}
  const out: AvailabilityState = {}
  for (const [key, value] of Object.entries(json)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const reason = (value as Record<string, unknown>).reason
    const checkedAt = (value as Record<string, unknown>).checkedAt
    out[key] = {
      reason: typeof reason === "string" ? (reason as UnavailableReason) : null,
      checkedAt: typeof checkedAt === "string" ? checkedAt : new Date(0).toISOString(),
    }
  }
  return out
}

/** The per metric reasons the compute module understands. */
export function availabilityMap(json: Json): Partial<Record<string, UnavailableReason>> {
  const out: Partial<Record<string, UnavailableReason>> = {}
  for (const [key, value] of Object.entries(readAvailability(json))) {
    if (value.reason) out[key] = value.reason
  }
  return out
}

export interface RunSyncDeps {
  db: Db
  now?: () => Date
  deadlineMs?: number
  /** Builds the Graph client. Tests pass a fake. */
  client?: (onResponse: (usage: ApiUsage) => void) => InstagramClient
}

/**
 * Does the work for a started run and closes it. Never throws for Meta
 * errors; infrastructure failures (the database) are recorded on the run and
 * rethrown so the caller logs them.
 */
export async function runSync(
  runId: string,
  accountId: string,
  deps: RunSyncDeps,
): Promise<SyncSummary> {
  const database = deps.db
  const now = deps.now ?? (() => new Date())
  const started = Date.now()
  const deadline = started + (deps.deadlineMs ?? DEFAULT_DEADLINE_MS)
  const summary: SyncSummary = {
    status: "succeeded",
    apiCalls: 0,
    daysFetched: 0,
    daysRemaining: 0,
    reelsFetched: 0,
    errors: [],
  }
  // Set from callbacks, so kept on an object rather than narrowed locals.
  const control: {
    stop: StopSync | null
    insightsDenied: boolean
    highUsage: boolean
    deadlineHit: boolean
  } = { stop: null, insightsDenied: false, highUsage: false, deadlineHit: false }

  const ig = (deps.client ?? instagramClient)((usage) => {
    summary.apiCalls++
    if (usage.maxPct !== null && usage.maxPct >= USAGE_BACKOFF_PCT) control.highUsage = true
  })
  const ctx = { accountId, runId }
  const outOfTime = () => {
    if (Date.now() > deadline) control.deadlineHit = true
    return control.deadlineHit || control.highUsage || control.stop !== null
  }
  const note = (where: string, err: unknown) => {
    summary.errors.push(`${where}: ${describeMetaError(err)}`)
    log.warn("analytics_sync_step_failed", {
      ...ctx,
      where,
      kind: err instanceof MetaApiError ? err.kind : "unknown",
      code: err instanceof MetaApiError ? err.details.code : undefined,
    })
  }
  /** Turns fatal Meta errors into a stop; everything else is noted. */
  const guard = async <T>(where: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof MetaApiError) {
        if (err.kind === "token") control.stop = new StopSync("token", err.message)
        else if (err.kind === "rate_limit") control.stop = new StopSync("rate_limit", err.message)
      }
      note(where, err)
      return null
    }
  }

  try {
    const { data: account, error: accountError } = await database
      .from("instagram_accounts")
      .select("*")
      .eq("id", accountId)
      .maybeSingle()
    if (accountError) throw new Error(`Account lookup failed: ${accountError.message}`)
    if (!account || account.status !== "active" || !account.access_token_encrypted) {
      summary.status = "failed"
      summary.errors.push("Instagram is not connected, so nothing was synced.")
      await finishRun(database, runId, summary)
      return summary
    }
    const token = decryptAccountToken(account)
    const state = await loadState(database, account.id)
    const availability = readAvailability(state.metric_availability)
    const stateUpdate: Partial<StateRow> = {}
    // Progress is saved the moment it is known, so a run that is cut off
    // still leaves the page with an accurate picture.
    const saveState = async (fields: Partial<StateRow>) => {
      Object.assign(stateUpdate, fields)
      const { error } = await database
        .from("ig_analytics_state")
        .update(fields)
        .eq("instagram_account_id", accountId)
      if (error) throw new Error(`Saving sync state failed: ${error.message}`)
    }

    // 1. Probe insights access with one small request.
    const today = dateInZone(now(), META_TIMEZONE)
    const yesterday = addDays(today, -1)
    try {
      await ig.getAccountInsights(token, { metrics: ["views"], ...metaDayWindow(yesterday) })
      await saveState({ insights_status: "ok" })
    } catch (err) {
      if (err instanceof MetaApiError && err.kind === "permission") {
        await saveState({ insights_status: "missing_permission" })
        control.insightsDenied = true
      } else if (err instanceof MetaApiError && err.kind === "token") {
        control.stop = new StopSync("token", err.message)
      } else if (err instanceof MetaApiError && err.kind === "rate_limit") {
        control.stop = new StopSync("rate_limit", err.message)
      }
      note("Checking insights access", err)
    }

    if (!control.stop && !control.insightsDenied) {
      // 2. Followers now: the only follower count the API offers.
      const followers = await guard("Follower count", () => ig.getFollowersCount(token))
      if (followers !== null) {
        await upsertDay(database, { instagram_account_id: accountId, date: today, follower_count: followers })
        availability.follows = {
          reason: followers < MIN_FOLLOWERS_FOR_FOLLOWS ? "min_followers" : null,
          checkedAt: now().toISOString(),
        }
      }

      // 3. Undocumented metrics: probe weekly whether Meta still serves them.
      for (const [column, metric] of Object.entries(LEGACY_METRICS)) {
        const known = availability[column]
        if (known && now().getTime() - Date.parse(known.checkedAt) <= LEGACY_PROBE_MS) continue
        try {
          await ig.getAccountInsights(token, { metrics: [metric], ...metaDayWindow(yesterday) })
          availability[column] = { reason: null, checkedAt: now().toISOString() }
        } catch (err) {
          if (err instanceof MetaApiError && err.kind === "invalid") {
            availability[column] = { reason: "api_removed", checkedAt: now().toISOString() }
          } else {
            note(`Checking ${metric}`, err)
          }
        }
      }
      const legacy = (Object.keys(LEGACY_METRICS) as LegacyColumn[]).filter(
        (column) => availability[column]?.reason === null,
      )

      // 4. Daily account metrics: recent days first, then the backfill.
      const startDate = state.backfill_start_date ?? addDays(today, -(BACKFILL_DAYS - 1))
      await saveState({
        backfill_start_date: startDate,
        metric_availability: availability as unknown as Json,
      })
      const pending = await datesToFetch(database, accountId, startDate, today)
      summary.daysRemaining = pending.length

      await pool(
        pending,
        async (date) => {
          const ok = await fetchDay(ig, token, accountId, date, legacy, database, guard)
          if (ok) {
            summary.daysFetched++
            summary.daysRemaining--
          }
        },
        outOfTime,
      )
      if (summary.daysRemaining === 0 && !state.backfill_completed_at) {
        await saveState({ backfill_completed_at: now().toISOString() })
      }

      // 5. Media and reel insights.
      if (!outOfTime()) await syncMedia(ig, token, accountId, database, now(), guard, outOfTime)
      if (!outOfTime()) {
        summary.reelsFetched = await syncReelInsights(
          ig, token, accountId, database, now(), guard, outOfTime,
        )
      }
    }

    // 6. Close out.
    const stop = control.stop
    if (stop?.reason === "token") {
      await markAccountExpired(database, accountId, stop.message)
    }
    if (stop?.reason === "rate_limit" || control.highUsage) {
      summary.errors.push("Paused to stay within Instagram's rate limits. The next sync continues.")
    }

    if (stop?.reason === "token" || control.insightsDenied) summary.status = "failed"
    else if (
      control.deadlineHit ||
      control.highUsage ||
      stop ||
      summary.errors.length > 0 ||
      summary.daysRemaining > 0
    ) {
      summary.status = "partial"
    }
    if (summary.status !== "failed") stateUpdate.last_synced_at = now().toISOString()
    stateUpdate.metric_availability = availability as unknown as Json

    const { error: stateError } = await database
      .from("ig_analytics_state")
      .update(stateUpdate)
      .eq("instagram_account_id", accountId)
    if (stateError) throw new Error(`Saving sync state failed: ${stateError.message}`)

    await finishRun(database, runId, summary)
    log.info("analytics_sync_finished", {
      ...ctx,
      status: summary.status,
      apiCalls: summary.apiCalls,
      daysFetched: summary.daysFetched,
      daysRemaining: summary.daysRemaining,
      reelsFetched: summary.reelsFetched,
      errors: summary.errors.length,
      ms: Date.now() - started,
    })
    return summary
  } catch (err) {
    summary.status = "failed"
    summary.errors.push("Something unexpected went wrong. The next sync will try again.")
    log.error("analytics_sync_crashed", { ...ctx, error: err })
    await finishRun(database, runId, summary).catch(() => undefined)
    throw err
  }
}

async function finishRun(database: Db, runId: string, summary: SyncSummary): Promise<void> {
  const { error } = await database
    .from("ig_sync_runs")
    .update({
      status: summary.status,
      finished_at: new Date().toISOString(),
      api_calls: summary.apiCalls,
      error: summary.errors.length ? summary.errors.join(" ").slice(0, 2000) : null,
    })
    .eq("id", runId)
  if (error) throw new Error(`Closing sync run failed: ${error.message}`)
}

async function loadState(database: Db, accountId: string): Promise<StateRow> {
  const { data, error } = await database
    .from("ig_analytics_state")
    .upsert(
      { instagram_account_id: accountId },
      { onConflict: "instagram_account_id", ignoreDuplicates: true },
    )
    .select("*")
  if (error) throw new Error(`Analytics state upsert failed: ${error.message}`)
  if (data?.[0]) return data[0]
  const { data: existing, error: readError } = await database
    .from("ig_analytics_state")
    .select("*")
    .eq("instagram_account_id", accountId)
    .single()
  if (readError) throw new Error(`Analytics state lookup failed: ${readError.message}`)
  return existing
}

async function upsertDay(database: Db, row: DailyInsert): Promise<void> {
  const { error } = await database
    .from("ig_account_daily_metrics")
    .upsert(row, { onConflict: "instagram_account_id,date" })
  if (error) throw new Error(`Saving daily metrics failed: ${error.message}`)
}

/** Days never fully fetched, plus the recent days Meta may still revise. */
async function datesToFetch(
  database: Db,
  accountId: string,
  startDate: string,
  today: string,
): Promise<string[]> {
  const { data, error } = await database
    .from("ig_account_daily_metrics")
    .select("date, fetched_at")
    .eq("instagram_account_id", accountId)
    .gte("date", startDate)
    .lte("date", today)
  if (error) throw new Error(`Daily metrics lookup failed: ${error.message}`)
  const done = new Set((data ?? []).filter((r) => r.fetched_at).map((r) => r.date))
  const recent = enumerateDates(addDays(today, -(RECENT_REFETCH_DAYS - 1)), today).reverse()
  const missing = enumerateDates(startDate, today)
    .reverse()
    .filter((d) => !done.has(d) && !recent.includes(d))
  return [...recent, ...missing]
}

type Guard = <T>(where: string, fn: () => Promise<T>) => Promise<T | null>

/**
 * Fetches one Meta day. Writes whatever succeeded; sets fetched_at only when
 * every request succeeded, so a partial day is fetched again next run.
 */
async function fetchDay(
  ig: InstagramClient,
  token: string,
  accountId: string,
  date: string,
  legacy: readonly LegacyColumn[],
  database: Db,
  guard: Guard,
): Promise<boolean> {
  const window = metaDayWindow(date)
  const row: DailyInsert = { instagram_account_id: accountId, date }
  let complete = true

  const totals = await fetchTotals(ig, token, window, guard, date)
  if (totals) {
    for (const [column, metric] of Object.entries(DAY_TOTAL_METRICS)) {
      row[column as keyof typeof DAY_TOTAL_METRICS] = totals.get(metric)?.value ?? null
    }
  } else {
    complete = false
  }

  const follows = await guard(`Follows for ${date}`, () =>
    ig.getAccountInsights(token, { metrics: [FOLLOWS_METRIC], ...window, breakdown: "follow_type" }),
  )
  if (follows) {
    // An empty result is Instagram declining to report (under 100 followers),
    // so both stay null rather than 0.
    const metric = follows.get(FOLLOWS_METRIC)
    const hasBreakdown = metric !== undefined && metric.breakdown.size > 0
    row.follows = hasBreakdown ? metric.breakdown.get("FOLLOWER") ?? 0 : null
    row.unfollows = hasBreakdown ? metric.breakdown.get("NON_FOLLOWER") ?? 0 : null
  } else {
    complete = false
  }

  if (legacy.length > 0) {
    const metrics = legacy.map((column) => LEGACY_METRICS[column])
    const values = await guard(`${metrics.join(", ")} for ${date}`, () =>
      ig.getAccountInsights(token, { metrics, ...window }),
    )
    if (values) {
      for (const column of legacy) row[column] = values.get(LEGACY_METRICS[column])?.value ?? null
    } else {
      complete = false
    }
  }

  if (Object.keys(row).length <= 2) return false
  if (complete) row.fetched_at = new Date().toISOString()
  await upsertDay(database, row)
  return complete
}

/**
 * All total_value metrics in one call. If Meta rejects the combination (one
 * metric "in development" can do that), fall back to one call per metric so
 * a single bad metric only loses itself.
 */
async function fetchTotals(
  ig: InstagramClient,
  token: string,
  window: { since: number; until: number },
  guard: Guard,
  date: string,
): Promise<Map<string, AccountMetricValue> | null> {
  const metrics = Object.values(DAY_TOTAL_METRICS)
  try {
    return await ig.getAccountInsights(token, { metrics, ...window })
  } catch (err) {
    if (!(err instanceof MetaApiError) || err.kind !== "invalid") {
      return guard(`Daily metrics for ${date}`, () => Promise.reject(err))
    }
  }
  const out = new Map<string, AccountMetricValue>()
  let anyFailed = false
  for (const metric of metrics) {
    const single = await guard(`${metric} for ${date}`, () =>
      ig.getAccountInsights(token, { metrics: [metric], ...window }),
    )
    if (single) {
      const value = single.get(metric)
      if (value) out.set(metric, value)
    } else {
      anyFailed = true
    }
  }
  return anyFailed ? null : out
}

async function syncMedia(
  ig: InstagramClient,
  token: string,
  accountId: string,
  database: Db,
  now: Date,
  guard: Guard,
  outOfTime: () => boolean,
): Promise<void> {
  const cutoff = now.getTime() - REEL_RECENT_DAYS * 24 * 60 * 60 * 1000
  let after: string | undefined
  for (let page = 0; page < MAX_MEDIA_PAGES && !outOfTime(); page++) {
    const result = await guard("Listing posts", () => ig.listMedia(token, after, 50))
    if (!result) return
    if (result.items.length > 0) {
      const { error } = await database.from("ig_media").upsert(
        result.items.map((m) => ({
          media_id: m.id,
          instagram_account_id: accountId,
          media_type: m.mediaType,
          media_product_type: m.productType,
          caption: m.caption?.slice(0, 2200) ?? null,
          permalink: m.permalink,
          thumbnail_url: m.thumbnailUrl,
          timestamp: m.timestamp,
        })),
        { onConflict: "media_id" },
      )
      if (error) throw new Error(`Saving media failed: ${error.message}`)
    }
    const oldest = result.items.at(-1)?.timestamp
    if (!result.nextCursor || (oldest && Date.parse(oldest) < cutoff)) return
    after = result.nextCursor
  }
}

/** Reels from the last 90 days every run; older reels once a week. */
async function syncReelInsights(
  ig: InstagramClient,
  token: string,
  accountId: string,
  database: Db,
  now: Date,
  guard: Guard,
  outOfTime: () => boolean,
): Promise<number> {
  const { data: reels, error } = await database
    .from("ig_media")
    .select("media_id, timestamp")
    .eq("instagram_account_id", accountId)
    .eq("media_product_type", "REELS")
    .order("timestamp", { ascending: false })
    .limit(1000)
  if (error) throw new Error(`Reel lookup failed: ${error.message}`)
  const ids = (reels ?? []).map((r) => r.media_id)
  if (ids.length === 0) return 0

  const fetchedAt = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: insightsError } = await database
      .from("ig_media_insights")
      .select("media_id, fetched_at")
      .in("media_id", ids.slice(i, i + 200))
    if (insightsError) throw new Error(`Reel insights lookup failed: ${insightsError.message}`)
    for (const r of data ?? []) fetchedAt.set(r.media_id, r.fetched_at)
  }

  const recentCutoff = now.getTime() - REEL_RECENT_DAYS * 24 * 60 * 60 * 1000
  const due = (reels ?? []).filter((r) => {
    if (r.timestamp && Date.parse(r.timestamp) >= recentCutoff) return true
    const last = fetchedAt.get(r.media_id)
    return !last || now.getTime() - Date.parse(last) > REEL_STALE_MS
  })

  let fetched = 0
  await pool(
    due,
    async (reel) => {
      const values = await fetchReelMetrics(ig, token, reel.media_id, guard)
      if (!values) return
      const { error: saveError } = await database.from("ig_media_insights").upsert(
        {
          media_id: reel.media_id,
          views: values.get(REEL_METRICS.views) ?? null,
          reach: values.get(REEL_METRICS.reach) ?? null,
          likes: values.get(REEL_METRICS.likes) ?? null,
          comments: values.get(REEL_METRICS.comments) ?? null,
          shares: values.get(REEL_METRICS.shares) ?? null,
          saves: values.get(REEL_METRICS.saves) ?? null,
          total_interactions: values.get(REEL_METRICS.total_interactions) ?? null,
          avg_watch_time_ms: values.get(REEL_METRICS.avg_watch_time_ms) ?? null,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "media_id" },
      )
      if (saveError) throw new Error(`Saving reel insights failed: ${saveError.message}`)
      fetched++
    },
    outOfTime,
  )
  return fetched
}

async function fetchReelMetrics(
  ig: InstagramClient,
  token: string,
  mediaId: string,
  guard: Guard,
): Promise<Map<string, number | null> | null> {
  const metrics = Object.values(REEL_METRICS)
  try {
    return await ig.getMediaInsights(token, mediaId, metrics)
  } catch (err) {
    if (!(err instanceof MetaApiError) || err.kind !== "invalid") {
      return guard(`Reel ${mediaId}`, () => Promise.reject(err))
    }
  }
  // One metric unsupported for this reel: fetch the rest one by one.
  const out = new Map<string, number | null>()
  for (const metric of metrics) {
    try {
      const single = await ig.getMediaInsights(token, mediaId, [metric])
      out.set(metric, single.get(metric) ?? null)
    } catch (err) {
      if (err instanceof MetaApiError && err.kind === "invalid") {
        out.set(metric, null)
        continue
      }
      return guard(`Reel ${mediaId} ${metric}`, () => Promise.reject(err))
    }
  }
  return out
}
