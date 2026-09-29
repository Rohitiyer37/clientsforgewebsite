import { useState } from "react"
import { ExternalLink, Film, ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  REEL_SORT_KEYS,
  type ReelDto,
  type ReelSortKey,
  type TopReelsDto,
} from "../../../shared/analytics"
import { formatCompact, formatExact, formatInstantDate, formatWatchTime } from "./format"
import { ExactValue, SectionHeading, Skeleton } from "./ui"

const SORT_LABELS: Record<ReelSortKey, string> = {
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
}

function SortToggle({
  value,
  onChange,
}: {
  value: ReelSortKey
  onChange: (k: ReelSortKey) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Rank reels by"
      className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1"
    >
      {REEL_SORT_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "rounded-full px-3 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
            value === key ? "bg-gold/15 text-gold-light" : "text-fg-muted hover:text-fg",
          )}
        >
          {SORT_LABELS[key]}
        </button>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-[11px] text-fg-muted">{label}</dt>
      <dd className="font-display text-[15px] font-semibold text-fg">
        {value === null ? (
          <span className="text-fg-muted/60" title="Instagram did not report this">
            n/a
          </span>
        ) : (
          <ExactValue display={formatCompact(value)} exact={formatExact(value)} />
        )}
      </dd>
    </div>
  )
}

function ReelCard({ reel, rank, timeZone }: { reel: ReelDto; rank: number; timeZone: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <article className="flex gap-4 rounded-3xl border border-white/[0.08] bg-ink-card/80 p-4 sm:flex-col sm:p-5">
      <div className="relative aspect-[9/16] w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] sm:aspect-auto sm:h-56 sm:w-full">
        {reel.thumbnailUrl && !broken ? (
          <img
            src={reel.thumbnailUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-fg-muted/50">
            <ImageOff className="h-5 w-5" />
            <span className="px-2 text-center text-[10px]">Preview unavailable</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-ink/85 px-2 py-0.5 font-display text-[12px] font-bold text-gold-light backdrop-blur">
          #{rank}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="line-clamp-2 text-[13px] leading-snug text-fg">
          {reel.caption?.trim() || <span className="text-fg-muted">No caption</span>}
        </p>
        {reel.postedAt && (
          <p className="mt-1 text-[12px] text-fg-muted">
            Posted {formatInstantDate(reel.postedAt, timeZone)}
          </p>
        )}
        <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2">
          <Stat label="Views" value={reel.views} />
          <Stat label="Likes" value={reel.likes} />
          <Stat label="Comments" value={reel.comments} />
          <Stat label="Shares" value={reel.shares} />
          <Stat label="Saves" value={reel.saves} />
          {reel.avgWatchTimeMs !== null && (
            <div>
              <dt className="text-[11px] text-fg-muted">Avg watch</dt>
              <dd className="font-display text-[15px] font-semibold tabular-nums text-fg">
                {formatWatchTime(reel.avgWatchTimeMs)}
              </dd>
            </div>
          )}
        </dl>
        {reel.permalink && (
          <a
            href={reel.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1.5 self-start rounded-lg pt-3 text-[13px] font-medium text-gold-light hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            View on Instagram
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
    </article>
  )
}

export function TopReels({ data, timeZone }: { data: TopReelsDto; timeZone: string }) {
  const [sort, setSort] = useState<ReelSortKey>("views")
  const reels = data.byKey[sort]

  return (
    <section aria-labelledby="top-reels-heading" className="space-y-5">
      <div id="top-reels-heading">
        <SectionHeading
          title="Top 3 reels"
          subtitle="Lifetime performance of reels posted in this period."
          action={
            data.reelsInPeriod > 0 ? <SortToggle value={sort} onChange={setSort} /> : undefined
          }
        />
      </div>

      {data.reelsInPeriod === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/[0.1] px-6 py-12 text-center">
          <Film className="h-6 w-6 text-fg-muted/60" />
          <p className="mt-3 text-[14px] text-fg">No reels posted in this period.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {reels.map((reel, i) => (
            <ReelCard key={reel.mediaId} reel={reel} rank={i + 1} timeZone={timeZone} />
          ))}
          {reels.length < 3 && (
            <div className="flex items-center justify-center rounded-3xl border border-dashed border-white/[0.1] p-6 text-center text-[13px] text-fg-muted sm:col-span-1">
              {reels.length === 1 ? "Only 1 reel was" : `Only ${reels.length} reels were`} posted in
              this period.
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export function TopReelsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-6 w-40" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-72 rounded-3xl" />
        ))}
      </div>
    </div>
  )
}
