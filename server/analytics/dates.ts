import {
  MAX_CUSTOM_RANGE_DAYS,
  PRESET_DAYS,
  type AnalyticsQuery,
  type DateRange,
  type RangePreset,
} from "../../shared/analytics"

/**
 * Calendar date math on "YYYY-MM-DD" strings. Dates are handled as plain
 * calendar days (UTC arithmetic) so daylight saving never shifts them, and
 * converted to instants only at the edges with an explicit time zone.
 */

/**
 * Instagram's daily insights are bucketed on Pacific Time days, the same
 * boundaries Meta uses for its day periods (end_time values fall on Pacific
 * midnight). Stored daily rows are keyed by that day.
 */
export const META_TIMEZONE = "America/Los_Angeles"
export const DEFAULT_CLIENT_TIMEZONE = "Asia/Kolkata"

const DAY_MS = 24 * 60 * 60 * 1000

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** The calendar date of an instant in a time zone. */
export function dateInZone(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

function toUtcMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

export function addDays(iso: string, n: number): string {
  return new Date(toUtcMs(iso) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Inclusive count of days from `from` to `to`. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS) + 1
}

export function enumerateDates(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** Offset of `tz` from UTC at `instant`, in milliseconds. */
function zoneOffsetMs(instant: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0")
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return asUtc - Math.floor(instant / 1000) * 1000
}

/** The instant a calendar day starts (00:00) in a time zone. */
export function startOfDayInZone(iso: string, tz: string): Date {
  const utcMidnight = toUtcMs(iso)
  // Two passes settle the offset across a daylight saving change.
  let guess = utcMidnight - zoneOffsetMs(utcMidnight, tz)
  guess = utcMidnight - zoneOffsetMs(guess, tz)
  return new Date(guess)
}

/**
 * since/until (unix seconds) selecting exactly one Meta day.
 *
 * Meta keys each daily bucket by its end_time, the Pacific midnight that ends
 * the day, and a total_value request includes every bucket whose end_time is
 * within [since, until] inclusive. A plain midnight to midnight window
 * therefore catches two buckets. Starting one second after midnight leaves
 * only the bucket that ends at `until`: the day asked for. Verified live on
 * 29 September 2026: seven such windows summed exactly to one 7 day request.
 */
export function metaDayWindow(iso: string): { since: number; until: number } {
  return {
    since: Math.floor(startOfDayInZone(iso, META_TIMEZONE).getTime() / 1000) + 1,
    until: Math.floor(startOfDayInZone(addDays(iso, 1), META_TIMEZONE).getTime() / 1000),
  }
}

export function previousPeriod(range: { from: string; to: string }): DateRange {
  const days = daysInclusive(range.from, range.to)
  return { from: addDays(range.from, -days), to: addDays(range.from, -1), days }
}

export class InvalidRangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InvalidRangeError"
  }
}

/**
 * Turns the query into a concrete range in the client's time zone. Presets
 * end yesterday, because Instagram is still counting today. Custom ranges are
 * clamped to the days we have stored (minDate) and to yesterday.
 */
export function resolveRange(
  query: AnalyticsQuery,
  opts: { tz: string; now: Date; minDate: string | null },
): DateRange & { preset: RangePreset | null } {
  const yesterday = addDays(dateInZone(opts.now, opts.tz), -1)

  if (query.from && query.to) {
    let from = query.from
    let to = query.to
    if (to > yesterday) to = yesterday
    if (opts.minDate && from < opts.minDate) from = opts.minDate
    if (from > to) throw new InvalidRangeError("There is no stored data for those dates yet.")
    const days = daysInclusive(from, to)
    if (days > MAX_CUSTOM_RANGE_DAYS) {
      throw new InvalidRangeError(`Pick a range of ${MAX_CUSTOM_RANGE_DAYS} days or less.`)
    }
    return { from, to, days, preset: null }
  }

  const preset = query.range ?? "30d"
  const days = PRESET_DAYS[preset]
  return { from: addDays(yesterday, -(days - 1)), to: yesterday, days, preset }
}
