import { useEffect, useId, useRef, useState } from "react"
import { CalendarRange } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { RANGE_PRESETS, type RangePreset } from "../../../shared/analytics"
import { formatRange } from "./format"

export type RangeSelection = { preset: RangePreset } | { from: string; to: string }

const PRESET_LABELS: Record<RangePreset, string> = {
  "7d": "7 days",
  "14d": "14 days",
  "30d": "30 days",
  "90d": "90 days",
}

/**
 * Preset ranges plus a custom picker. Custom dates are limited to what has
 * been stored (`min`) and to yesterday (`max`).
 */
export function RangePicker({
  value,
  onChange,
  min,
  max,
  current,
}: {
  value: RangeSelection
  onChange: (next: RangeSelection) => void
  min: string | null
  max: string | null
  current: { from: string; to: string } | null
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(current?.from ?? "")
  const [to, setTo] = useState(current?.to ?? "")
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fromId = useId()
  const toId = useId()
  const isCustom = !("preset" in value)

  useEffect(() => {
    if (!open) return
    setFrom(current?.from ?? "")
    setTo(current?.to ?? "")
    setError(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("mousedown", onClick)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("mousedown", onClick)
    }
  }, [open, current?.from, current?.to])

  function apply() {
    if (!from || !to) return setError("Pick both dates.")
    if (from > to) return setError("The start date must be on or before the end date.")
    if (min && from < min) return setError("That start date is before the data we have.")
    if (max && to > max) return setError("The end date can be yesterday at the latest.")
    onChange({ from, to })
    setOpen(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      <div
        role="radiogroup"
        aria-label="Date range"
        className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1"
      >
        {RANGE_PRESETS.map((preset) => {
          const active = "preset" in value && value.preset === preset
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ preset })}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
                active ? "bg-gold/15 text-gold-light" : "text-fg-muted hover:text-fg",
              )}
            >
              {PRESET_LABELS[preset]}
            </button>
          )
        })}
        <button
          type="button"
          role="radio"
          aria-checked={isCustom}
          aria-expanded={open}
          aria-haspopup="dialog"
          disabled={!min || !max}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-not-allowed disabled:opacity-50",
            isCustom ? "bg-gold/15 text-gold-light" : "text-fg-muted hover:text-fg",
          )}
        >
          <CalendarRange className="h-3.5 w-3.5" aria-hidden />
          {isCustom && current ? formatRange(current.from, current.to) : "Custom"}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Custom date range"
          className="absolute right-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2.5rem))] rounded-2xl border border-white/10 bg-ink-raised p-4 shadow-card"
        >
          <div className="grid grid-cols-2 gap-3">
            <label htmlFor={fromId} className="text-[12px] text-fg-muted">
              From
              <input
                id={fromId}
                type="date"
                value={from}
                min={min ?? undefined}
                max={max ?? undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink px-2 py-1.5 text-[13px] text-fg [color-scheme:dark] focus:border-gold/50 focus:outline-none"
              />
            </label>
            <label htmlFor={toId} className="text-[12px] text-fg-muted">
              To
              <input
                id={toId}
                type="date"
                value={to}
                min={min ?? undefined}
                max={max ?? undefined}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink px-2 py-1.5 text-[13px] text-fg [color-scheme:dark] focus:border-gold/50 focus:outline-none"
              />
            </label>
          </div>
          {min && (
            <p className="mt-2 text-[11px] text-fg-muted">
              Data is available from {formatRange(min, max ?? min)}.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-[12px] text-red-300">
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              className={buttonVariants({ variant: "gold", size: "sm" })}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
