import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts"

import { cn } from "@/lib/utils"

import type { KpiDto, SeriesPoint } from "../../../shared/analytics"
import { formatCompact, formatDay, formatDelta, formatExact } from "./format"
import { CHART, ExactValue, InfoTip, Skeleton } from "./ui"

function Delta({ kpi }: { kpi: KpiDto }) {
  if (kpi.deltaPct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-fg-muted">
        <span aria-hidden>—</span>
        <span className="sr-only">No comparison.</span>
        {kpi.deltaNote && <InfoTip text={kpi.deltaNote} label="Why there is no comparison" />}
      </span>
    )
  }
  const up = kpi.deltaPct > 0
  const flat = kpi.deltaPct === 0
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-medium tabular-nums",
        flat
          ? "bg-white/[0.05] text-fg-muted"
          : up
            ? "bg-emerald-400/10 text-emerald-300"
            : "bg-red-400/10 text-red-300",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {formatDelta(kpi.deltaPct)}
      <span className="sr-only">
        {flat ? "no change" : up ? "up" : "down"} versus the previous period
      </span>
    </span>
  )
}

function SparkTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: SeriesPoint }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-white/10 bg-ink-raised px-2.5 py-1.5 text-[12px] shadow-card">
      <p className="text-fg-muted">{formatDay(point.date)}</p>
      <p className="font-medium tabular-nums text-fg">
        {point.value === null ? "No data" : formatExact(point.value)}
      </p>
    </div>
  )
}

function Sparkline({ series, label }: { series: SeriesPoint[]; label: string }) {
  const values = series.map((p) => p.value).filter((v): v is number => v !== null)
  if (values.length < 2) return <div className="h-10" aria-hidden />
  const summary = `${label} per day: lowest ${formatExact(Math.min(...values))}, highest ${formatExact(Math.max(...values))}.`
  return (
    <div className="h-10" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            content={<SparkTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART.line}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART.line, stroke: "#161616", strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function KpiCard({ kpi }: { kpi: KpiDto }) {
  return (
    <article
      aria-label={kpi.label}
      className={cn(
        "flex min-h-[168px] flex-col rounded-3xl border p-5",
        kpi.available ? "border-white/[0.08] bg-ink-card/80" : "border-white/[0.05] bg-ink-card/40",
      )}
    >
      <div className="flex items-center gap-1.5">
        <h3 className="text-[13px] font-medium text-fg-muted">{kpi.label}</h3>
        <InfoTip text={kpi.description} label={`About ${kpi.label}`} />
      </div>

      {kpi.available && kpi.total !== null ? (
        <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <ExactValue
              display={formatCompact(kpi.total)}
              exact={formatExact(kpi.total)}
              className="font-display text-[32px] font-semibold leading-none text-fg"
            />
            <Delta kpi={kpi} />
          </div>
          {kpi.daysWithData < kpi.days && (
            <p className="mt-1.5 text-[11px] text-amber-200/80">
              Based on {kpi.daysWithData} of {kpi.days} days. The rest are still syncing.
            </p>
          )}
          <div className="mt-auto pt-3">
            <Sparkline series={kpi.series} label={kpi.label} />
          </div>
        </>
      ) : (
        <div className="mt-2 flex flex-1 flex-col">
          <p className="flex items-center gap-1.5 font-display text-[20px] font-semibold text-fg-muted/60">
            Not available
            {kpi.unavailableReason && (
              <InfoTip text={kpi.unavailableReason} label={`Why ${kpi.label} is not available`} />
            )}
          </p>
        </div>
      )}
    </article>
  )
}

export function KpiSkeleton() {
  return (
    <div className="flex min-h-[168px] flex-col rounded-3xl border border-white/[0.06] bg-ink-card/50 p-5">
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="mt-3 h-8 w-28" />
      <Skeleton className="mt-auto h-10 w-full" />
    </div>
  )
}
