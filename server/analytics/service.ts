import type {
  AnalyticsQuery,
  AnalyticsResponse,
  KpiDto,
  Section,
  SyncStatusDto,
} from "../../shared/analytics"
import type { Db } from "../db"
import type { Row } from "../database.types"
import { HttpError } from "../http"
import { getAccountForClient } from "../instagram/accounts"
import { availabilityMap, REFRESH_INTERVAL_SECONDS } from "../instagram/analytics-sync"
import { log } from "../log"
import { FUNNEL_BENCHMARKS } from "./benchmarks"
import {
  UNAVAILABLE_TEXT,
  buildFunnel,
  buildKpis,
  rankReels,
  stageFromKpi,
  type AvailabilityMap,
  type DailyMetricsRow,
  type ReelInput,
} from "./compute"
import {
  DEFAULT_CLIENT_TIMEZONE,
  InvalidRangeError,
  META_TIMEZONE,
  addDays,
  dateInZone,
  isValidTimeZone,
  previousPeriod,
  resolveRange,
  startOfDayInZone,
} from "./dates"

type AccountRow = Row<"instagram_accounts">
type StateRow = Row<"ig_analytics_state">

async function clientTimezone(database: Db, clientId: string): Promise<string> {
  const { data, error } = await database
    .from("clients")
    .select("timezone")
    .eq("id", clientId)
    .single()
  if (error) throw new Error(`Client lookup failed: ${error.message}`)
  return isValidTimeZone(data.timezone) ? data.timezone : DEFAULT_CLIENT_TIMEZONE
}

async function loadState(database: Db, accountId: string): Promise<StateRow | null> {
  const { data, error } = await database
    .from("ig_analytics_state")
    .select("*")
    .eq("instagram_account_id", accountId)
    .maybeSingle()
  if (error) throw new Error(`Analytics state lookup failed: ${error.message}`)
  return data
}

async function storedRange(
  database: Db,
  accountId: string,
): Promise<{ min: string; max: string } | null> {
  const query = (ascending: boolean) =>
    database
      .from("ig_account_daily_metrics")
      .select("date")
      .eq("instagram_account_id", accountId)
      .not("fetched_at", "is", null)
      .order("date", { ascending })
      .limit(1)
      .maybeSingle()
  const [first, last] = await Promise.all([query(true), query(false)])
  if (first.error) throw new Error(`Stored range lookup failed: ${first.error.message}`)
  if (last.error) throw new Error(`Stored range lookup failed: ${last.error.message}`)
  if (!first.data || !last.data) return null
  return { min: first.data.date, max: last.data.date }
}

/** Sync state for the header, the banners, and the first sync poller. */
export async function buildSyncStatus(
  database: Db,
  account: AccountRow | null,
  state: StateRow | null,
  hasData: boolean,
  now: Date,
): Promise<SyncStatusDto> {
  if (!account || account.status === "revoked" || !account.access_token_encrypted) {
    return {
      state: "not_connected",
      running: false,
      lastSyncedAt: null,
      backfillComplete: false,
      refreshAvailableAt: null,
      lastError: null,
    }
  }

  const { data: run, error } = await database
    .from("ig_sync_runs")
    .select("status, started_at, error")
    .eq("instagram_account_id", account.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Sync run lookup failed: ${error.message}`)

  // A run older than 5 minutes that never finished has crashed.
  const running =
    run?.status === "running" && now.getTime() - Date.parse(run.started_at) < 5 * 60 * 1000
  const backfillComplete = Boolean(state?.backfill_completed_at)
  let refreshAvailableAt: string | null = null
  if (run && backfillComplete) {
    const unlock = Date.parse(run.started_at) + REFRESH_INTERVAL_SECONDS * 1000
    if (unlock > now.getTime()) refreshAvailableAt = new Date(unlock).toISOString()
  }

  let syncState: SyncStatusDto["state"] = "ready"
  if (account.status === "expired") syncState = "expired"
  else if (state?.insights_status === "missing_permission") syncState = "missing_permission"
  else if (!hasData) syncState = "first_sync"

  return {
    state: syncState,
    running,
    lastSyncedAt: state?.last_synced_at ?? null,
    backfillComplete,
    refreshAvailableAt,
    lastError: run && run.status !== "running" && run.status !== "succeeded" ? run.error : null,
  }
}

async function section<T>(name: string, fn: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    log.error("analytics_section_failed", { section: name, error: err })
    return { ok: false, error: "This section couldn't load. Try again in a moment." }
  }
}

/**
 * How Instagram's Pacific Time days line up with the client's time zone, or
 * null when they are the same.
 */
export function dayBoundaryNote(tz: string, onDate: string): string | null {
  const pacificMidnight = startOfDayInZone(onDate, META_TIMEZONE)
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(pacificMidnight)
  const time = local.replace(/\s/g, " ").toLowerCase()
  if (time === "12:00 am") return null
  return `Instagram counts each day in US Pacific Time, so each day's numbers here cover ${time} to ${time} the next day in your time zone.`
}

async function loadReels(
  database: Db,
  accountId: string,
  fromInstant: Date,
  toInstant: Date,
): Promise<ReelInput[]> {
  const { data: media, error } = await database
    .from("ig_media")
    .select("media_id, media_product_type, caption, permalink, thumbnail_url, timestamp")
    .eq("instagram_account_id", accountId)
    .eq("media_product_type", "REELS")
    .gte("timestamp", fromInstant.toISOString())
    .lt("timestamp", toInstant.toISOString())
    .order("timestamp", { ascending: false })
    .limit(500)
  if (error) throw new Error(`Reel lookup failed: ${error.message}`)
  if (!media || media.length === 0) return []

  const { data: insights, error: insightsError } = await database
    .from("ig_media_insights")
    .select("*")
    .in("media_id", media.map((m) => m.media_id))
  if (insightsError) throw new Error(`Reel insights lookup failed: ${insightsError.message}`)
  const byId = new Map((insights ?? []).map((i) => [i.media_id, i]))

  return media.map((m) => {
    const i = byId.get(m.media_id)
    return {
      mediaId: m.media_id,
      productType: m.media_product_type,
      caption: m.caption,
      permalink: m.permalink,
      thumbnailUrl: m.thumbnail_url,
      postedAt: m.timestamp,
      views: i?.views ?? null,
      likes: i?.likes ?? null,
      comments: i?.comments ?? null,
      shares: i?.shares ?? null,
      saves: i?.saves ?? null,
      avgWatchTimeMs: i?.avg_watch_time_ms ?? null,
      insightsFetchedAt: i?.fetched_at ?? null,
    }
  })
}

export async function getInstagramAnalytics(
  database: Db,
  clientId: string,
  query: AnalyticsQuery,
  now = new Date(),
): Promise<AnalyticsResponse> {
  const [tz, account] = await Promise.all([
    clientTimezone(database, clientId),
    getAccountForClient(database, clientId),
  ])
  const connected = account && account.status !== "revoked" && account.access_token_encrypted
  const state = connected ? await loadState(database, account.id) : null
  const available = connected ? await storedRange(database, account.id) : null
  const sync = await buildSyncStatus(database, connected ? account : null, state, available !== null, now)

  const base: AnalyticsResponse = {
    account: connected
      ? { username: account.username, profilePictureUrl: account.profile_picture_url }
      : null,
    sync,
    timezone: tz,
    availableRange: null,
    range: null,
    previousRange: null,
    dayBoundaryNote: null,
    dmTrackingStartedAt: state?.dm_tracking_started_at ?? null,
    kpis: { ok: false, error: "No data yet." },
    topReels: { ok: false, error: "No data yet." },
    funnel: { ok: false, error: "No data yet." },
  }
  if (!connected || !available) return base

  const yesterday = addDays(dateInZone(now, tz), -1)
  const availableRange = {
    min: available.min,
    max: available.max < yesterday ? available.max : yesterday,
  }

  let range
  try {
    range = resolveRange(query, { tz, now, minDate: available.min })
  } catch (err) {
    if (err instanceof InvalidRangeError) throw new HttpError(400, err.message, "INVALID_RANGE")
    throw err
  }
  const previous = previousPeriod(range)

  const { data: rawRows, error: rowsError } = await database
    .from("ig_account_daily_metrics")
    .select("*")
    .eq("instagram_account_id", account.id)
    .gte("date", previous.from)
    .lte("date", range.to)
  if (rowsError) throw new Error(`Daily metrics lookup failed: ${rowsError.message}`)
  const rows: DailyMetricsRow[] = (rawRows ?? []).map((r) => ({
    date: r.date,
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves,
    follows: r.follows,
    unfollows: r.unfollows,
    profile_visits: r.profile_visits,
    bio_link_taps: r.bio_link_taps,
    reach: r.reach,
    follower_count: r.follower_count,
  }))

  const availability: AvailabilityMap = availabilityMap(state?.metric_availability ?? {})

  const fromInstant = startOfDayInZone(range.from, tz)
  const toInstant = startOfDayInZone(addDays(range.to, 1), tz)

  const kpis = await section("kpis", async () =>
    buildKpis({ rows, range, previous, availability }),
  )

  const topReels = await section("top_reels", async () =>
    rankReels(await loadReels(database, account.id, fromInstant, toInstant)),
  )

  const funnel = await section("funnel", async () => {
    const list: KpiDto[] = kpis.ok
      ? kpis.data
      : buildKpis({ rows, range, previous, availability })
    const byKey = new Map(list.map((k) => [k.key, k]))

    const trackingStarted = state?.dm_tracking_started_at ?? null
    const hasDmData = Boolean(trackingStarted || state?.dm_backfill_completed_at)
    let newDms: { value: number | null; unavailableReason: string | null; split: { organic: number; automation: number } | null } = {
      value: null,
      unavailableReason: UNAVAILABLE_TEXT.dm_tracking_off,
      split: null,
    }
    if (hasDmData) {
      const { data: daily, error } = await database.rpc("ig_new_dm_daily", {
        p_account_id: account.id,
        p_from: fromInstant.toISOString(),
        p_to: toInstant.toISOString(),
        p_tz: tz,
      })
      if (error) throw new Error(`New DM lookup failed: ${error.message}`)
      const organic = (daily ?? []).reduce((n, d) => n + Number(d.organic), 0)
      const automation = (daily ?? []).reduce((n, d) => n + Number(d.automation), 0)
      newDms = { value: organic + automation, unavailableReason: null, split: { organic, automation } }
    }

    return buildFunnel(
      {
        views: stageFromKpi(byKey.get("views")),
        profile_visits: stageFromKpi(byKey.get("profile_visits")),
        follows: stageFromKpi(byKey.get("follows")),
        new_dms: newDms,
      },
      FUNNEL_BENCHMARKS,
      {
        trackingStartDate: trackingStarted ? dateInZone(new Date(trackingStarted), tz) : null,
        range,
      },
    )
  })

  return {
    ...base,
    availableRange,
    range,
    previousRange: previous,
    dayBoundaryNote: dayBoundaryNote(tz, range.to),
    kpis,
    topReels,
    funnel,
  }
}

/** The status alone, for the page's poller while the first sync runs. */
export async function getSyncStatus(
  database: Db,
  clientId: string,
  now = new Date(),
): Promise<SyncStatusDto> {
  const account = await getAccountForClient(database, clientId)
  const connected = account && account.status !== "revoked" && account.access_token_encrypted
  const state = connected ? await loadState(database, account.id) : null
  const available = connected ? await storedRange(database, account.id) : null
  return buildSyncStatus(database, connected ? account : null, state, available !== null, now)
}
