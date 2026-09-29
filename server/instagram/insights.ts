import { z } from "zod"

import type { BackfillThread } from "../analytics/dm"

/**
 * Parsers for Instagram insights, conversations, and rate limit headers.
 * Pure and strict: a metric Instagram left out of the response comes back as
 * null, never 0, because Meta documents that unavailable data is returned as
 * an empty set rather than a zero.
 */

// ---------------------------------------------------------------- account

const BreakdownResult = z.object({
  dimension_values: z.array(z.string()),
  value: z.number(),
})

const AccountMetric = z.object({
  name: z.string(),
  total_value: z
    .object({
      value: z.number().optional(),
      breakdowns: z
        .array(
          z.object({
            dimension_keys: z.array(z.string()).optional(),
            results: z.array(BreakdownResult).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  values: z.array(z.object({ value: z.unknown(), end_time: z.string().optional() })).optional(),
})

const InsightsBody = z.object({ data: z.array(z.unknown()) })

export interface AccountMetricValue {
  /** The metric total, or null when Instagram returned no value. */
  value: number | null
  /** Breakdown dimension value (for example FOLLOWER) to count. */
  breakdown: Map<string, number>
}

/** Parses a total_value response into metric name -> value. */
export function parseAccountInsights(body: unknown): Map<string, AccountMetricValue> {
  const out = new Map<string, AccountMetricValue>()
  const parsed = InsightsBody.safeParse(body)
  if (!parsed.success) return out

  for (const raw of parsed.data.data) {
    const metric = AccountMetric.safeParse(raw)
    if (!metric.success) continue
    const breakdown = new Map<string, number>()
    for (const b of metric.data.total_value?.breakdowns ?? []) {
      for (const r of b.results ?? []) {
        const key = r.dimension_values.join("|")
        breakdown.set(key, (breakdown.get(key) ?? 0) + r.value)
      }
    }
    let value: number | null = metric.data.total_value?.value ?? null
    // Some metrics come back as a single element "values" array instead.
    if (value === null && metric.data.values?.length === 1) {
      const v = metric.data.values[0]?.value
      value = typeof v === "number" ? v : null
    }
    out.set(metric.data.name, { value, breakdown })
  }
  return out
}

// ------------------------------------------------------------------ media

const MediaMetric = z.object({
  name: z.string(),
  values: z.array(z.object({ value: z.unknown() })).optional(),
  total_value: z.object({ value: z.number().optional() }).optional(),
})

/** Parses a media insights response into metric name -> lifetime value. */
export function parseMediaInsights(body: unknown): Map<string, number | null> {
  const out = new Map<string, number | null>()
  const parsed = InsightsBody.safeParse(body)
  if (!parsed.success) return out
  for (const raw of parsed.data.data) {
    const metric = MediaMetric.safeParse(raw)
    if (!metric.success) continue
    const v = metric.data.values?.[0]?.value ?? metric.data.total_value?.value
    out.set(metric.data.name, typeof v === "number" && Number.isFinite(v) ? v : null)
  }
  return out
}

// ---------------------------------------------------------- conversations

const Participant = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  username: z.string().optional(),
})

const ConversationMessage = z.object({
  id: z.string().optional(),
  created_time: z.string(),
  from: z
    .object({ id: z.union([z.string(), z.number()]).transform(String) })
    .partial()
    .optional(),
})

const Conversation = z.object({
  id: z.string(),
  participants: z.object({ data: z.array(Participant) }).optional(),
  messages: z
    .object({
      data: z.array(ConversationMessage),
      paging: z.object({ next: z.string().optional() }).partial().optional(),
    })
    .optional(),
})

const ConversationsBody = z.object({
  data: z.array(z.unknown()),
  paging: z
    .object({
      cursors: z.object({ after: z.string().optional() }).partial().optional(),
      next: z.string().optional(),
    })
    .partial()
    .optional(),
})

export function parseConversations(body: unknown): {
  threads: BackfillThread[]
  nextCursor: string | null
} {
  const parsed = ConversationsBody.safeParse(body)
  if (!parsed.success) return { threads: [], nextCursor: null }

  const threads: BackfillThread[] = []
  for (const raw of parsed.data.data) {
    const c = Conversation.safeParse(raw)
    if (!c.success) continue
    threads.push({
      participants: (c.data.participants?.data ?? []).map((p) => ({
        id: p.id,
        username: p.username ?? null,
      })),
      messages: (c.data.messages?.data ?? []).map((m) => ({
        createdTime: m.created_time,
        fromId: m.from?.id ?? null,
      })),
      hasMoreMessages: Boolean(c.data.messages?.paging?.next),
    })
  }
  const next = parsed.data.paging?.next ? parsed.data.paging.cursors?.after ?? null : null
  return { threads, nextCursor: next }
}

// ------------------------------------------------------------ rate limits

export interface ApiUsage {
  /** Highest usage percentage Meta reported across its counters. */
  maxPct: number | null
  /** Minutes until access returns, when Meta is already throttling. */
  regainAccessMinutes: number | null
}

const USAGE_KEYS = [
  "call_count",
  "call_volume",
  "total_cputime",
  "cpu_time",
  "total_time",
  "acc_id_util_pct",
]

function collectUsage(value: unknown, into: ApiUsage): void {
  if (Array.isArray(value)) {
    for (const v of value) collectUsage(v, into)
    return
  }
  if (!value || typeof value !== "object") return
  for (const [key, v] of Object.entries(value)) {
    if (typeof v === "number" && USAGE_KEYS.includes(key)) {
      into.maxPct = Math.max(into.maxPct ?? 0, v)
    } else if (typeof v === "number" && key === "estimated_time_to_regain_access") {
      into.regainAccessMinutes = Math.max(into.regainAccessMinutes ?? 0, v)
    } else if (v && typeof v === "object") {
      collectUsage(v, into)
    }
  }
}

/**
 * Reads X-App-Usage and X-Business-Use-Case-Usage. Both are JSON with
 * percentages of the allowed quota; the business header nests them per
 * account ID. Unknown or malformed headers are ignored.
 */
export function parseUsageHeaders(headers: Headers): ApiUsage {
  const usage: ApiUsage = { maxPct: null, regainAccessMinutes: null }
  for (const name of ["x-app-usage", "x-business-use-case-usage"]) {
    const raw = headers.get(name)
    if (!raw) continue
    try {
      collectUsage(JSON.parse(raw), usage)
    } catch {
      // A header we can't read tells us nothing; carry on.
    }
  }
  return usage
}
