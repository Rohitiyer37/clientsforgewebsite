/**
 * Display formatting for analytics. Everything that shows a number goes
 * through here, so compact and exact values always agree.
 */

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})
const exact = new Intl.NumberFormat("en-US")

/** 12.4K, 1.2M. Values under 1,000 are shown in full. */
export function formatCompact(n: number): string {
  return Math.abs(n) < 1000 ? exact.format(n) : compact.format(n)
}

export function formatExact(n: number): string {
  return exact.format(n)
}

/**
 * A percentage with sensible precision: 0.06%, 8.2%, 45%. Values just under
 * 100 keep a decimal so 99.8% never rounds up to a misleading 100%.
 */
export function formatPct(pct: number): string {
  const abs = Math.abs(pct)
  const digits = abs === 0 ? 0 : abs < 1 ? 2 : abs < 10 || (abs > 99 && abs < 100) ? 1 : 0
  return `${pct.toFixed(digits)}%`
}

/** +12.5% / -3% for deltas. */
export function formatDelta(pct: number): string {
  const rounded = Math.abs(pct) < 10 ? pct.toFixed(1) : pct.toFixed(0)
  return `${pct > 0 ? "+" : ""}${rounded}%`
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "2026-09-10" as "10 Sep" (or "10 Sep 2026" with the year). */
export function formatDay(iso: string, withYear = false): string {
  const [y, m, d] = iso.split("-").map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]}${withYear ? ` ${y}` : ""}`
}

export function formatRange(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4)
  return `${formatDay(from, !sameYear)} to ${formatDay(to, true)}`
}

/** An instant as a date in the client's time zone, for example "23 Sep 2026". */
export function formatInstantDate(iso: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(iso))
  return formatDay(day, true)
}

/** "just now", "4 min ago", "3 h ago", "2 days ago". */
export function formatRelative(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

/** Milliseconds as "7.4s" or "1m 12s". */
export function formatWatchTime(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}
