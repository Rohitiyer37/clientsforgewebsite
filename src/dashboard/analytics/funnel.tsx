import { ArrowDown, TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

import type { FunnelDto, FunnelStageDto } from "../../../shared/analytics"
import { formatCompact, formatExact, formatPct } from "./format"
import { CHART, ExactValue, InfoTip, SectionHeading, Skeleton } from "./ui"

/** Smallest bar width, in percent, so tiny stages stay visible. Labels stay exact. */
const MIN_WIDTH_PCT = 8

function barWidth(value: number, max: number): number {
  if (max <= 0) return MIN_WIDTH_PCT
  return Math.max(MIN_WIDTH_PCT, (value / max) * 100)
}

function StageBar({ stage, index, max }: { stage: FunnelStageDto; index: number; max: number }) {
  if (!stage.available || stage.value === null) {
    return (
      <div
        className="mx-auto flex h-12 w-[45%] min-w-[140px] items-center justify-center rounded-xl border border-dashed border-white/15 text-[12px] text-fg-muted/70"
        aria-hidden
      >
        Not available
      </div>
    )
  }

  const width = barWidth(stage.value, max)
  const split = stage.split
  if (split && stage.value > 0) {
    const organicPct = (split.organic / stage.value) * 100
    return (
      <div
        className="mx-auto flex h-12 gap-[2px] overflow-hidden rounded-xl"
        style={{ width: `${width}%` }}
        aria-hidden
      >
        {split.organic > 0 && (
          <div className="h-full" style={{ width: `${organicPct}%`, background: CHART.organic }} />
        )}
        {split.automation > 0 && (
          <div
            className="h-full"
            style={{ width: `${100 - organicPct}%`, background: CHART.automation }}
          />
        )}
      </div>
    )
  }

  return (
    <div
      aria-hidden
      className="mx-auto h-12 rounded-xl"
      style={{ width: `${width}%`, background: CHART.stages[index] ?? CHART.stages[3] }}
    />
  )
}

function DropOff({ stage }: { stage: FunnelStageDto }) {
  if (!stage.dropOff || !stage.step) return null
  const { lost, pct } = stage.dropOff
  const gained = lost < 0
  return (
    <p className="flex items-center justify-center gap-1.5 py-1.5 text-[12px] text-fg-muted">
      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      {gained ? (
        <span>
          {formatExact(-lost)} more than {stage.step.fromLabel.toLowerCase()}
        </span>
      ) : (
        <span>
          {formatExact(lost)} dropped off
          {pct !== null && <> ({formatPct(pct)})</>}
        </span>
      )}
    </p>
  )
}

function StageRow({
  stage,
  index,
  max,
  isLeak,
}: {
  stage: FunnelStageDto
  index: number
  max: number
  isLeak: boolean
}) {
  return (
    <li>
      {index > 0 && <DropOff stage={stage} />}
      <div
        className={cn(
          "rounded-2xl p-3 sm:p-4",
          isLeak ? "bg-amber-400/[0.06] ring-1 ring-amber-400/30" : "",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="sm:w-56 sm:shrink-0">
            <div className="flex items-center gap-1.5">
              <h3
                className={cn(
                  "text-[13px] font-medium",
                  stage.available ? "text-fg-muted" : "text-fg-muted/60",
                )}
              >
                {stage.label}
              </h3>
              {!stage.available && stage.unavailableReason && (
                <InfoTip
                  text={stage.unavailableReason}
                  label={`Why ${stage.label} is not available`}
                />
              )}
            </div>
            {stage.available && stage.value !== null ? (
              <ExactValue
                display={formatCompact(stage.value)}
                exact={formatExact(stage.value)}
                className="font-display text-[24px] font-semibold text-fg"
              />
            ) : (
              <p className="font-display text-[18px] font-semibold text-fg-muted/60">
                Not available
              </p>
            )}
            {stage.step && (
              <p className="mt-0.5 text-[12px] text-fg-muted">
                {stage.step.fromLabel} → {stage.label}:{" "}
                <span className="font-medium text-fg">
                  {stage.step.pct === null ? "—" : formatPct(stage.step.pct)}
                </span>
              </p>
            )}
            {stage.ofTopPct !== null && (
              <p className="text-[12px] text-fg-muted">{formatPct(stage.ofTopPct)} of views</p>
            )}
            {stage.split && (
              <ul className="mt-1.5 space-y-0.5 text-[12px] text-fg-muted">
                <li className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: CHART.organic }}
                    aria-hidden
                  />
                  Organic:
                  <span className="font-medium text-fg">{formatExact(stage.split.organic)}</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: CHART.automation }}
                    aria-hidden
                  />
                  From automations:
                  <span className="font-medium text-fg">{formatExact(stage.split.automation)}</span>
                </li>
              </ul>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <StageBar stage={stage} index={index} max={max} />
          </div>
        </div>
        {isLeak && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-200">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
            Biggest leak
          </p>
        )}
      </div>
    </li>
  )
}

export function Funnel({ data }: { data: FunnelDto }) {
  const values = data.stages
    .map((s) => (s.available ? s.value : null))
    .filter((v): v is number => v !== null)
  const max = values.length ? Math.max(...values) : 0
  const leakKey = data.leak?.toKey ?? null

  return (
    <section aria-labelledby="funnel-heading" className="space-y-5">
      <div id="funnel-heading">
        <SectionHeading
          title="Content funnel"
          subtitle="How views turn into profile visits, follows, and new conversations."
        />
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-ink-card/80 p-3 sm:p-5">
        <ol aria-label="Funnel stages, top to bottom">
          {data.stages.map((stage, i) => (
            <StageRow
              key={stage.key}
              stage={stage}
              index={i}
              max={max}
              isLeak={leakKey === stage.key && Boolean(data.leak?.belowBenchmark)}
            />
          ))}
        </ol>
      </div>

      {data.leak && (
        <div
          className={cn(
            "rounded-2xl border p-4",
            data.leak.belowBenchmark
              ? "border-amber-400/30 bg-amber-400/[0.06]"
              : "border-white/[0.08] bg-white/[0.02]",
          )}
        >
          <p className="flex items-center gap-2 text-[14px] font-medium text-fg">
            <TriangleAlert
              className={cn(
                "h-4 w-4",
                data.leak.belowBenchmark ? "text-amber-300" : "text-fg-muted",
              )}
              aria-hidden
            />
            {data.leak.belowBenchmark ? "Biggest leak" : "Weakest step"}: {data.leak.fromLabel} →{" "}
            {data.leak.toLabel} ({formatPct(data.leak.pct)})
          </p>
          <p className="mt-1 text-[13px] text-fg-muted">
            Benchmark {formatPct(data.leak.benchmarkLow)} to {formatPct(data.leak.benchmarkHigh)}.{" "}
            {data.leak.belowBenchmark
              ? data.leak.hint
              : "Every step is at or above its benchmark. This one has the most room to grow."}
          </p>
        </div>
      )}

      <div className="space-y-1 text-[12px] leading-relaxed text-fg-muted/80">
        {data.dmTrackingNote && <p>{data.dmTrackingNote}</p>}
        <p>
          Profile visits, follows and DMs are account-wide and include traffic from all sources, not
          only reels.
        </p>
        <p>
          Bars are sized by value, with a minimum width so small stages stay visible. The numbers
          are exact.
        </p>
      </div>
    </section>
  )
}

export function FunnelSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-6 w-44" />
      <div className="space-y-4 rounded-3xl border border-white/[0.06] bg-ink-card/50 p-5">
        {["w-full", "w-3/5", "w-1/3", "w-1/5"].map((w) => (
          <div key={w} className="flex items-center gap-6">
            <Skeleton className="h-10 w-40 shrink-0" />
            <div className="flex flex-1 justify-center">
              <Skeleton className={`h-12 ${w}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
