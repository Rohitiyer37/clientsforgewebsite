import { useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"

import { MAX_KEYWORDS, MAX_KEYWORD_LENGTH } from "../../../shared/automation"
import { normalizeKeyword } from "../../../shared/keywords"

/** Chip input. Enter or comma adds a keyword; Backspace on empty removes the last. */
export function KeywordInput({
  value,
  onChange,
  invalid,
}: {
  value: string[]
  onChange: (next: string[]) => void
  invalid?: boolean
}) {
  const [draft, setDraft] = useState("")

  function add(raw: string) {
    const parts = raw
      .split(",")
      .map(normalizeKeyword)
      .filter((k) => k.length > 0 && k.length <= MAX_KEYWORD_LENGTH)
    if (parts.length === 0) return
    const next = [...value]
    for (const p of parts) if (!next.includes(p) && next.length < MAX_KEYWORDS) next.push(p)
    onChange(next)
    setDraft("")
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      add(draft)
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div>
      <div
        className={`flex min-h-[52px] flex-wrap items-center gap-2 rounded-2xl border bg-ink-raised/60 px-3 py-2 focus-within:ring-2 focus-within:ring-gold/50 ${
          invalid ? "border-red-400/50" : "border-white/10"
        }`}
      >
        {value.map((k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 py-1 pl-3 pr-1.5 text-[13px] text-gold-light"
          >
            {k}
            <button
              type="button"
              aria-label={`Remove ${k}`}
              onClick={() => onChange(value.filter((x) => x !== k))}
              className="rounded-full p-0.5 hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? "Add another" : "e.g. guide, link, price"}
          aria-label="Add a keyword"
          maxLength={MAX_KEYWORD_LENGTH * 2}
          disabled={value.length >= MAX_KEYWORDS}
          className="min-w-[140px] flex-1 bg-transparent py-1 text-[14px] text-fg placeholder:text-fg-muted/50 focus:outline-none"
        />
      </div>
      <p className="mt-2 text-[12px] text-fg-muted">
        Press Enter after each keyword. Matching ignores capitals and punctuation, and uses whole
        words, so "guide" matches "GUIDE!" but not "guides".
      </p>
    </div>
  )
}
