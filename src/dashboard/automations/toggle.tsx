import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  busy?: boolean
}

/** Accessible switch. The label is announced even when it is not visible. */
export function Toggle({ checked, onChange, label, disabled, busy }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-gold/50 bg-gold/80" : "border-white/15 bg-white/[0.06]",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin text-ink" />}
      </span>
    </button>
  )
}
