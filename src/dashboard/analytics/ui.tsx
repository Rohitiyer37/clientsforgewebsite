import { useId, useState, type ReactNode } from "react"
import { AlertCircle, Info, RotateCw } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Chart colors, validated for the dark card surface (#161616). */
export const CHART = {
  /** Sparkline stroke and the accent hue. */
  line: "#E0B866",
  /** Funnel stages, an ordinal ramp: light at the top, darker down the funnel. */
  stages: ["#F0D39A", "#D4AE62", "#A8863C"] as const,
}

/**
 * A small info icon with a tooltip that opens on hover and on keyboard focus.
 * The text is also the icon's accessible description, so it is never
 * hover only.
 */
export function InfoTip({ text, label = "More info" }: { text: string; label?: string }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full text-fg-muted/70 transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-60 -translate-x-1/2 rounded-xl border border-white/10 bg-ink-raised px-3 py-2 text-[12px] leading-relaxed text-fg shadow-card transition-opacity",
          open ? "opacity-100" : "sr-only opacity-0",
        )}
      >
        {text}
      </span>
    </span>
  )
}

/**
 * A value that shows its exact figure on hover and focus, and always to
 * screen readers.
 */
export function ExactValue({
  display,
  exact,
  className,
}: {
  display: string
  exact: string
  className?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const same = display === exact
  return (
    <span className="relative inline-flex">
      <span
        tabIndex={same ? undefined : 0}
        aria-describedby={same ? undefined : id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={cn(
          "rounded-md tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
          className,
        )}
      >
        {display}
      </span>
      {!same && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute bottom-full left-0 z-30 mb-2 whitespace-nowrap rounded-lg border border-white/10 bg-ink-raised px-2.5 py-1 font-sans text-[12px] font-medium text-fg shadow-card transition-opacity",
            open ? "opacity-100" : "sr-only opacity-0",
          )}
        >
          {exact}
        </span>
      )}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-white/[0.05]", className)} />
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-fg">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-3xl border border-red-400/20 bg-red-400/[0.05] px-6 py-10 text-center"
    >
      <AlertCircle className="h-5 w-5 text-red-300" />
      <p className="text-[14px] text-fg">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <RotateCw />
          Try again
        </button>
      )}
    </div>
  )
}
