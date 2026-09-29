import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { AlertTriangle, ArrowLeft, Instagram, Loader2, RefreshCw } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  RANGE_PRESETS,
  type AnalyticsResponse,
  type RangePreset,
  type SyncStatusDto,
} from "../../../shared/analytics"
import { ApiError, api } from "@/dashboard/api"
import { formatRange, formatRelative } from "@/dashboard/analytics/format"
import { Funnel, FunnelSkeleton } from "@/dashboard/analytics/funnel"
import { KpiCard, KpiSkeleton } from "@/dashboard/analytics/kpi-card"
import { RangePicker, type RangeSelection } from "@/dashboard/analytics/range-picker"
import { TopReels, TopReelsSkeleton } from "@/dashboard/analytics/top-reels"
import { SectionError, Skeleton } from "@/dashboard/analytics/ui"
import { useToast } from "@/dashboard/toast"

const POLL_MS = 5_000
/** How often the page may continue an unfinished first backfill. */
const CONTINUE_EVERY_MS = 65_000
const DATE = /^\d{4}-\d{2}-\d{2}$/

const CONNECT_RESULTS: Record<string, { tone: "success" | "error"; message: string }> = {
  connected: { tone: "success", message: "Instagram connected. Your analytics are syncing now." },
  denied: {
    tone: "error",
    message: "The Instagram connection was cancelled. Nothing was changed.",
  },
  state: { tone: "error", message: "That connection attempt expired. Please try again." },
  not_professional: {
    tone: "error",
    message:
      "This is a personal Instagram account. Switch it to a Creator or Business account and connect again.",
  },
  in_use: {
    tone: "error",
    message: "This Instagram account is already connected to another Clientsforge workspace.",
  },
  permissions: {
    tone: "error",
    message: "Instagram needs every permission it asks for. Connect again and allow them all.",
  },
  failed: { tone: "error", message: "Instagram connection failed. Please try again." },
}

function readSelection(params: URLSearchParams): RangeSelection {
  const from = params.get("from")
  const to = params.get("to")
  if (from && to && DATE.test(from) && DATE.test(to)) return { from, to }
  const range = params.get("range")
  if (range && (RANGE_PRESETS as readonly string[]).includes(range)) {
    return { preset: range as RangePreset }
  }
  return { preset: "30d" }
}

function toQuery(selection: RangeSelection): string {
  return "preset" in selection
    ? new URLSearchParams({ range: selection.preset }).toString()
    : new URLSearchParams({ from: selection.from, to: selection.to }).toString()
}

function connect() {
  window.location.assign("/api/instagram/connect?return=analytics")
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}

export default function InstagramAnalyticsPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const selection = readSelection(params)
  const query = toQuery(selection)

  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [sync, setSync] = useState<SyncStatusDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; invalidRange: boolean } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const now = useNow(30_000)
  const lastContinue = useRef(0)
  const wasRunning = useRef(false)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const res = await api<AnalyticsResponse>(`/api/analytics/instagram?${query}`, { signal })
        setData(res)
        setSync(res.sync)
        wasRunning.current = res.sync.running
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setError({
          message: err instanceof ApiError ? err.message : "Could not load your analytics.",
          invalidRange: err instanceof ApiError && err.code === "INVALID_RANGE",
        })
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [query],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  // Show the OAuth result once, then drop it from the URL.
  useEffect(() => {
    const result = params.get("ig")
    if (!result) return
    const entry = CONNECT_RESULTS[result] ?? CONNECT_RESULTS.failed
    if (entry) toast(entry.tone, entry.message)
    const next = new URLSearchParams(params)
    next.delete("ig")
    setParams(next, { replace: true })
  }, [params, setParams, toast])

  // While a sync runs, or the first backfill is unfinished, poll the status.
  // When a run finishes, reload the numbers. An unfinished backfill is
  // continued about once a minute while the page is open.
  const pollable =
    sync !== null &&
    (sync.state === "first_sync" || sync.state === "ready") &&
    (sync.running || !sync.backfillComplete)

  useEffect(() => {
    if (!pollable) return
    let cancelled = false
    const tick = async () => {
      try {
        const { sync: next } = await api<{ sync: SyncStatusDto }>("/api/analytics/instagram/status")
        if (cancelled) return
        setSync(next)
        if (wasRunning.current && !next.running) void load()
        wasRunning.current = next.running
        if (
          !next.running &&
          !next.backfillComplete &&
          Date.now() - lastContinue.current > CONTINUE_EVERY_MS
        ) {
          lastContinue.current = Date.now()
          const res = await api<{ sync: SyncStatusDto }>("/api/analytics/instagram/refresh", {
            method: "POST",
          }).catch(() => null)
          if (!cancelled && res) {
            setSync(res.sync)
            wasRunning.current = res.sync.running
          }
        }
      } catch {
        // A missed poll is harmless; the next tick tries again.
      }
    }
    const t = window.setInterval(() => void tick(), POLL_MS)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [pollable, load])

  function select(next: RangeSelection) {
    setParams(new URLSearchParams(toQuery(next)))
  }

  async function refresh() {
    setRefreshing(true)
    try {
      const res = await api<{ sync: SyncStatusDto }>("/api/analytics/instagram/refresh", {
        method: "POST",
      })
      setSync(res.sync)
      wasRunning.current = res.sync.running
      toast("success", "Refreshing your data from Instagram.")
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Could not start a refresh.")
      if (err instanceof ApiError && err.status === 409) void load()
    } finally {
      setRefreshing(false)
    }
  }

  const status = sync ?? data?.sync ?? null

  return (
    <>
      <Link
        to="/dashboard/analytics"
        className="inline-flex items-center gap-1.5 rounded-lg text-[13px] text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Content Analytics
      </Link>

      {!data && loading ? (
        <PageSkeleton />
      ) : !data && error ? (
        <div className="mt-8">
          <SectionError message={error.message} onRetry={() => void load()} />
        </div>
      ) : data && status?.state === "not_connected" ? (
        <ConnectState />
      ) : data && status ? (
        <div className="mt-6 space-y-10">
          <Header
            data={data}
            status={status}
            now={now}
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />

          {status.state === "expired" && (
            <Banner
              title="Reconnect Instagram"
              body="Instagram ended this connection, so your analytics can't update until you reconnect."
            />
          )}
          {status.state === "missing_permission" && (
            <Banner
              title="Reconnect Instagram to enable analytics."
              body="Your connection was made before analytics existed, so Instagram hasn't shared your insights yet. Reconnecting keeps your automations running."
            />
          )}

          {status.state === "first_sync" ? (
            <FirstSync status={status} />
          ) : !data.range ? null : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] text-fg-muted" aria-live="polite">
                  {data.range ? formatRange(data.range.from, data.range.to) : null}
                  {data.previousRange && (
                    <span className="text-fg-muted/70">
                      {" "}
                      · compared with {formatRange(data.previousRange.from, data.previousRange.to)}
                    </span>
                  )}
                </p>
                <RangePicker
                  value={selection}
                  onChange={select}
                  min={data.availableRange?.min ?? null}
                  max={data.availableRange?.max ?? null}
                  current={data.range}
                />
              </div>

              {error ? (
                <div className="space-y-3">
                  <SectionError message={error.message} onRetry={() => void load()} />
                  {error.invalidRange && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => select({ preset: "30d" })}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Show the last 30 days
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Sections data={data} loading={loading} onRetry={() => void load()} />
              )}

              <footer className="space-y-1 border-t border-white/[0.06] pt-5 text-[12px] leading-relaxed text-fg-muted/80">
                <p>Dates are shown in {data.timezone.replace(/_/g, " ")} time.</p>
                {data.dayBoundaryNote && <p>{data.dayBoundaryNote}</p>}
                <p>
                  Instagram can take up to 48 hours to finalise a day, so recent days may still
                  change.
                </p>
              </footer>
            </>
          )}
        </div>
      ) : null}
    </>
  )
}

function Sections({
  data,
  loading,
  onRetry,
}: {
  data: AnalyticsResponse
  loading: boolean
  onRetry: () => void
}) {
  return (
    <>
      <section aria-label="Key metrics">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <KpiSkeleton key={i} />
            ))}
          </div>
        ) : data.kpis.ok ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.kpis.data.map((kpi) => (
              <KpiCard key={kpi.key} kpi={kpi} />
            ))}
          </div>
        ) : (
          <SectionError message={data.kpis.error} onRetry={onRetry} />
        )}
      </section>

      {loading ? (
        <TopReelsSkeleton />
      ) : data.topReels.ok ? (
        <TopReels data={data.topReels.data} timeZone={data.timezone} />
      ) : (
        <SectionError message={data.topReels.error} onRetry={onRetry} />
      )}

      {loading ? (
        <FunnelSkeleton />
      ) : data.funnel.ok ? (
        <Funnel data={data.funnel.data} />
      ) : (
        <SectionError message={data.funnel.error} onRetry={onRetry} />
      )}
    </>
  )
}

function Header({
  data,
  status,
  now,
  refreshing,
  onRefresh,
}: {
  data: AnalyticsResponse
  status: SyncStatusDto
  now: number
  refreshing: boolean
  onRefresh: () => void
}) {
  const [broken, setBroken] = useState(false)
  const lockedUntil = status.refreshAvailableAt ? Date.parse(status.refreshAvailableAt) : 0
  const locked = lockedUntil > now
  const lockedMinutes = Math.max(1, Math.ceil((lockedUntil - now) / 60_000))
  const canRefresh = status.state === "ready" || status.state === "first_sync"

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {data.account?.profilePictureUrl && !broken ? (
          <img
            src={data.account.profilePictureUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover"
          />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-fg-muted">
            <Instagram className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            @{data.account?.username}
          </h1>
          <p className="mt-0.5 text-[13px] text-fg-muted" aria-live="polite">
            {status.running ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-light" aria-hidden />
                Updating from Instagram…
              </span>
            ) : status.lastSyncedAt ? (
              <>Last updated {formatRelative(status.lastSyncedAt, now)}</>
            ) : (
              "Not updated yet"
            )}
          </p>
        </div>
      </div>

      {canRefresh && (
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || status.running || locked}
            className={cn(buttonVariants({ variant: "outline" }), "self-start sm:self-auto")}
          >
            <RefreshCw className={cn(status.running && "animate-spin")} />
            Refresh
          </button>
          {locked && !status.running && (
            <p className="text-[11px] text-fg-muted">Available again in {lockedMinutes} min</p>
          )}
        </div>
      )}
    </div>
  )
}

function Banner({ title, body }: { title: string; body: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <p className="text-[14px] font-medium text-fg">{title}</p>
          <p className="text-[13px] text-fg-muted">{body}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={connect}
        className={cn(buttonVariants({ variant: "gold", size: "sm" }), "shrink-0")}
      >
        <RefreshCw />
        Reconnect
      </button>
    </div>
  )
}

function FirstSync({ status }: { status: SyncStatusDto }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center rounded-3xl border border-white/[0.08] bg-ink-card/80 px-6 py-16 text-center"
    >
      <Loader2 className="h-7 w-7 animate-spin text-gold-light" aria-hidden />
      <h2 className="mt-5 font-display text-xl font-semibold text-fg">
        Syncing your data, this takes a minute
      </h2>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-fg-muted">
        We're pulling the last 90 days from Instagram. This page updates by itself when it's ready.
      </p>
      {status.lastError && !status.running && (
        <p className="mt-4 max-w-md text-[12px] text-amber-200/90">{status.lastError}</p>
      )}
    </div>
  )
}

function ConnectState() {
  return (
    <div className="mt-8 flex flex-col items-center rounded-3xl border border-white/[0.08] bg-ink-card/80 px-6 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-light">
        <Instagram className="h-6 w-6" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold text-fg">Connect Instagram</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-fg-muted">
        Link your Creator or Business account to see your views, top reels, and content funnel.
      </p>
      <button
        type="button"
        onClick={connect}
        className={cn(buttonVariants({ variant: "gold" }), "mt-6")}
      >
        <Instagram />
        Connect Instagram
      </button>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="mt-6 space-y-10" role="status" aria-label="Loading analytics">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <TopReelsSkeleton />
      <FunnelSkeleton />
    </div>
  )
}
