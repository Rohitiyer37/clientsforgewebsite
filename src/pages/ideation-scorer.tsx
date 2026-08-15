import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"

import { buttonVariants } from "@/components/ui/button"
import DotPattern from "@/components/ui/dot-pattern-1"
import { Swirling } from "@/components/ui/swirling"
import {
  scoreIdea,
  type IdeaAnswers,
  type IdeaResult,
  type Q4,
} from "@/lib/ideation-score"
import { cn } from "@/lib/utils"

/* ---------------------------------------------------------------- storage */

const STORAGE_KEY = "clientsforge:ideationscorer:v1"
const MAX_ENTRIES = 50

interface StoredEntry {
  id: string
  idea: string
  q1: 1 | 3 | 5
  q2: number
  q3: 1 | 3 | 5
  q4: Q4
  createdAt: string
}

const Q4_KEYS: Q4[] = ["several", "one", "none", "flopped"]

function isEntry(value: unknown): value is StoredEntry {
  if (!value || typeof value !== "object") return false
  const e = value as Record<string, unknown>
  return (
    typeof e.id === "string" &&
    typeof e.idea === "string" &&
    (e.q1 === 1 || e.q1 === 3 || e.q1 === 5) &&
    typeof e.q2 === "number" &&
    e.q2 >= 1 &&
    e.q2 <= 10 &&
    (e.q3 === 1 || e.q3 === 3 || e.q3 === 5) &&
    typeof e.q4 === "string" &&
    Q4_KEYS.includes(e.q4 as Q4) &&
    typeof e.createdAt === "string"
  )
}

/** Newest last. Returns an empty list if storage is unavailable or malformed. */
function readHistory(): StoredEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry)
  } catch {
    return []
  }
}

function appendEntry(answers: IdeaAnswers): StoredEntry[] {
  const entry: StoredEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now()),
    idea: answers.idea,
    q1: answers.q1,
    q2: answers.q2,
    q3: answers.q3,
    q4: answers.q4,
    createdAt: new Date().toISOString(),
  }
  try {
    const next = [...readHistory(), entry].slice(-MAX_ENTRIES)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    return next
  } catch {
    return []
  }
}

function clearStoredHistory() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do. The session keeps working without history.
  }
}

/* ------------------------------------------------------------------- copy */

const BAND_COPY: Record<IdeaResult["band"], { heading: string; body: string }> =
  {
    "Make it": {
      heading: "Make this one first.",
      body: "Both halves hold. The topic can travel and the people it reaches are the ones you want. Shoot it this week before the angle goes stale.",
    },
    "Queue it": {
      heading: "Worth making, not urgent.",
      body: "Solid on both halves without being exceptional on either. Put it in the queue behind anything scoring higher, and do not spend your best production effort here.",
    },
    "Rework the angle": {
      heading: "The topic is fine. The angle is not.",
      body: "Something in this idea is working, but not enough to earn a shoot. Change one variable and score it again before you commit.",
    },
    "Kill it": {
      heading: "Do not make this.",
      body: "This costs a slot in your calendar and returns very little. Killing it is the cheapest decision available right now.",
    },
  }

function diagnose(result: IdeaResult, answers: IdeaAnswers): string {
  if (result.capped) {
    return "Relevance capped this score. Whatever it reaches, it is not reaching your buyer."
  }
  if (answers.q4 === "flopped") {
    return "Others have made this and it did not work. Assume the format is the problem, not your execution."
  }
  if (result.reach - result.worth >= 20) {
    return "This travels further than it is worth. It pulls views, but not the people who buy from you."
  }
  if (result.worth - result.reach >= 20) {
    return "Right people, low ceiling. The idea is aimed correctly but the topic caps how far it can go."
  }
  if (answers.q3 === 1) {
    return "Nothing about this is yours. A hundred accounts could post it and nobody would notice which one did."
  }
  if (answers.q4 === "none" && result.score >= 60) {
    return "No proof either way. Strong on paper, so treat it as a test rather than a certainty."
  }
  return "No single weak link. The score is a fair reflection of a balanced idea."
}

const SCORING_LINES = [
  "Checking the ceiling on reach",
  "Weighing relevance against reach",
  "Testing the idea against proof",
  "Writing the call",
]

const Q1_OPTIONS = [
  { value: 5, label: "Yes, this travels past my niche" },
  { value: 3, label: "It performs inside my niche, not beyond" },
  { value: 1, label: "No, the audience for this is small" },
] as const

const Q3_OPTIONS = [
  { value: 5, label: "Yes, people have literally asked me this" },
  { value: 3, label: "It would be missed, but it is not unique" },
  { value: 1, label: "No, there are a hundred like it already" },
] as const

const Q4_OPTIONS: { value: Q4; label: string }[] = [
  { value: "several", label: "Several have worked" },
  { value: "one", label: "One has worked" },
  { value: "none", label: "No examples either way" },
  { value: "flopped", label: "Examples exist and they flopped" },
]

/* ------------------------------------------------------------- primitives */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"

function OptionButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2.5 text-left text-[14px] transition-colors duration-200",
        focusRing,
        selected
          ? "border-gold bg-gold/10 text-fg"
          : "border-ink-line bg-ink-raised/50 text-fg-muted hover:border-white/25 hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  )
}

function QuestionCard({
  step,
  question,
  helper,
  children,
}: {
  step: number
  question: string
  helper: string
  children: React.ReactNode
}) {
  return (
    <fieldset className="rounded-2xl border border-ink-line bg-ink-card p-5 sm:p-6">
      <legend className="sr-only">{question}</legend>
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[13px] font-medium tabular-nums text-gold">
          0{step}
        </span>
        <p className="font-display text-[16px] font-semibold leading-snug tracking-tight text-fg">
          {question}
        </p>
      </div>
      <p className="ml-[26px] mt-1.5 text-[13px] leading-relaxed text-fg-muted">
        {helper}
      </p>
      <div className="mt-4">{children}</div>
    </fieldset>
  )
}

function ScoreBar({
  label,
  value,
  reduce,
}: {
  label: string
  value: number
  reduce: boolean | null
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] text-fg-muted">{label}</span>
        <span className="font-display text-[14px] font-semibold tabular-nums text-fg">
          {value}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gold-gradient-135"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${value}%` }}
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }
          }
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- page */

type Phase = "form" | "scoring" | "result"

export default function IdeationScorer() {
  const reduce = useReducedMotion()

  const [phase, setPhase] = useState<Phase>("form")
  const [idea, setIdea] = useState("")
  const [q1, setQ1] = useState<1 | 3 | 5 | null>(null)
  const [q2, setQ2] = useState<number | null>(null)
  const [q3, setQ3] = useState<1 | 3 | 5 | null>(null)
  const [q4, setQ4] = useState<Q4 | null>(null)

  const [answers, setAnswers] = useState<IdeaAnswers | null>(null)
  const [history, setHistory] = useState<StoredEntry[]>([])
  const [mounted, setMounted] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    setMounted(true)
    setHistory(readHistory())
  }, [])

  useEffect(() => {
    const previous = document.title
    document.title = "Idea Scorer | Clientsforge"
    return () => {
      document.title = previous
    }
  }, [])

  const complete =
    idea.trim().length > 0 && q1 !== null && q2 !== null && q3 !== null && q4 !== null

  const result = useMemo(
    () => (answers ? scoreIdea(answers) : null),
    [answers],
  )

  /* The scoring state lasts a fixed 5000ms. It is not tied to async work. */
  useEffect(() => {
    if (phase !== "scoring") return
    const timer = window.setTimeout(() => setPhase("result"), 5000)
    return () => window.clearTimeout(timer)
  }, [phase])

  /* Cycle the scoring lines. Held static when reduced motion is requested. */
  useEffect(() => {
    if (phase !== "scoring" || reduce) return
    setLineIndex(0)
    const interval = window.setInterval(() => {
      setLineIndex((i) => (i + 1) % SCORING_LINES.length)
    }, 1250)
    return () => window.clearInterval(interval)
  }, [phase, reduce])

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!complete) return

      const next: IdeaAnswers = {
        idea: idea.trim(),
        q1: q1 as 1 | 3 | 5,
        q2: q2 as number,
        q3: q3 as 1 | 3 | 5,
        q4: q4 as Q4,
      }

      // Save before showing the scoring state so a refresh never loses the idea.
      const updated = appendEntry(next)
      setHistory(updated)
      setAnswers(next)
      setPhase("scoring")
    },
    [complete, idea, q1, q2, q3, q4],
  )

  const reset = useCallback(() => {
    setIdea("")
    setQ1(null)
    setQ2(null)
    setQ3(null)
    setQ4(null)
    setAnswers(null)
    setPhase("form")
  }, [])

  const loadEntry = useCallback((entry: StoredEntry) => {
    setAnswers({
      idea: entry.idea,
      q1: entry.q1,
      q2: entry.q2,
      q3: entry.q3,
      q4: entry.q4,
    })
    setPhase("result")
  }, [])

  const fade = reduce
    ? { duration: 0 }
    : { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }

  const recent = useMemo(() => [...history].reverse().slice(0, 5), [history])

  return (
    <main className="min-h-screen px-6 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-2xl">
        {/* Keying on phase remounts the panel, so each state fades in on its
            own. No exit animation, which keeps the swap from ever stalling. */}
        <motion.div
          key={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
        >
            {/* ----------------------------------------------------- form */}
            {phase === "form" && (
              <>
              <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-gold">
                Clientsforge
              </p>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">
                Idea Scorer
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">
                Answer four questions about a video idea. Get a score out of 100
                and a clear call on whether to make it.
              </p>

              <form onSubmit={handleSubmit} className="mt-10 space-y-4">
                <div className="rounded-2xl border border-ink-line bg-ink-card p-5 sm:p-6">
                  <label
                    htmlFor="idea"
                    className="font-display text-[16px] font-semibold tracking-tight text-fg"
                  >
                    What is the video idea?
                  </label>
                  <input
                    id="idea"
                    type="text"
                    required
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="One line. The angle, not the topic."
                    className={cn(
                      "mt-4 h-12 w-full rounded-full border border-ink-line bg-ink-raised/50 px-5 text-[14px] text-fg transition-colors placeholder:text-fg-muted/60 hover:border-white/25",
                      focusRing,
                    )}
                  />
                </div>

                <QuestionCard
                  step={1}
                  question="Does this video idea have the potential to get 100k views?"
                  helper="Judge the ceiling of the topic, not your best case."
                >
                  <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
                    {Q1_OPTIONS.map((o) => (
                      <OptionButton
                        key={o.value}
                        selected={q1 === o.value}
                        onClick={() => setQ1(o.value)}
                      >
                        {o.label}
                      </OptionButton>
                    ))}
                  </div>
                </QuestionCard>

                <QuestionCard
                  step={2}
                  question="How relevant is this to your ICP?"
                  helper="10 means only your buyer clicks this. 1 means they happen to be in the crowd."
                >
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={q2 === n}
                        aria-label={`Relevance ${n} out of 10`}
                        onClick={() => setQ2(n)}
                        className={cn(
                          "h-10 w-10 rounded-full border text-[14px] tabular-nums transition-colors duration-200",
                          focusRing,
                          q2 === n
                            ? "border-gold bg-gold/10 text-fg"
                            : "border-ink-line bg-ink-raised/50 text-fg-muted hover:border-white/25 hover:text-fg",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11px] text-fg-muted/70">
                    <span>1 to 2 unrelated crowd</span>
                    <span>5 to 6 ICP is present</span>
                    <span>9 to 10 only my ICP</span>
                  </div>
                </QuestionCard>

                <QuestionCard
                  step={3}
                  question="If this video were never posted, would anyone care?"
                  helper="Be honest. Most ideas fail here, not on reach."
                >
                  <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
                    {Q3_OPTIONS.map((o) => (
                      <OptionButton
                        key={o.value}
                        selected={q3 === o.value}
                        onClick={() => setQ3(o.value)}
                      >
                        {o.label}
                      </OptionButton>
                    ))}
                  </div>
                </QuestionCard>

                <QuestionCard
                  step={4}
                  question="Are there examples of videos on this same thing actually working?"
                  helper="Working means real views from the right audience, not just old videos existing."
                >
                  <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
                    {Q4_OPTIONS.map((o) => (
                      <OptionButton
                        key={o.value}
                        selected={q4 === o.value}
                        onClick={() => setQ4(o.value)}
                      >
                        {o.label}
                      </OptionButton>
                    ))}
                  </div>
                </QuestionCard>

                <button
                  type="submit"
                  disabled={!complete}
                  className={cn(
                    buttonVariants({ variant: "gold", size: "lg" }),
                    "w-full",
                  )}
                >
                  Score this idea
                </button>
              </form>
              </>
            )}

            {/* -------------------------------------------------- scoring */}
            {phase === "scoring" && (
              <div className="flex min-h-[60vh] flex-col items-center justify-center">
              <Swirling className="size-14 text-gold" />
              <div className="mt-8 h-5">
                {reduce ? (
                  <p className="text-[14px] text-fg-muted">Scoring your idea</p>
                ) : (
                  <motion.p
                    key={lineIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="text-[14px] text-fg-muted"
                  >
                    {SCORING_LINES[lineIndex]}
                  </motion.p>
                )}
              </div>
              </div>
            )}

            {/* --------------------------------------------------- result */}
            {phase === "result" && result && answers && (
              <>
              {/* Score card */}
              <div className="relative overflow-hidden rounded-2xl border border-ink-line bg-ink-card p-8 text-center sm:p-10">
                <DotPattern
                  width={5}
                  height={5}
                  className="z-0 fill-fg-muted/15 md:fill-fg-muted/20"
                />
                <div className="relative z-10">
                  <div
                    role="status"
                    className="font-display text-[88px] font-bold leading-none tracking-tight text-gold-gradient sm:text-[104px]"
                  >
                    {result.score}
                    <span className="text-[28px] text-fg-muted sm:text-[32px]">
                      /100
                    </span>
                  </div>
                  <p className="mt-3 font-display text-[15px] font-semibold uppercase tracking-[0.18em] text-gold">
                    {result.band}
                  </p>
                  <p className="mx-auto mt-5 max-w-md text-[14px] leading-relaxed text-fg-muted">
                    {answers.idea}
                  </p>
                </div>
              </div>

              {/* The call */}
              <section className="mt-8">
                <h2 className="font-display text-2xl font-bold tracking-tight text-fg">
                  {BAND_COPY[result.band].heading}
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
                  {BAND_COPY[result.band].body}
                </p>
              </section>

              {/* Breakdown */}
              <section className="mt-8 rounded-2xl border border-ink-line bg-ink-card p-6">
                <div className="space-y-5">
                  <ScoreBar label="Reach" value={result.reach} reduce={reduce} />
                  <ScoreBar
                    label="Worth reaching"
                    value={result.worth}
                    reduce={reduce}
                  />
                </div>
                <p className="mt-5 border-t border-ink-line pt-4 text-[13px] text-fg-muted">
                  Proof multiplier applied: {result.proofMultiplier.toFixed(2)}x
                </p>
              </section>

              {/* Weak link */}
              <section className="mt-4 rounded-2xl border border-gold/25 bg-gold/[0.06] p-6">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold">
                  The weak link
                </p>
                <p className="mt-2.5 text-[15px] leading-relaxed text-fg">
                  {diagnose(result, answers)}
                </p>
              </section>

              {/* Actions */}
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={reset}
                  className={cn(
                    buttonVariants({ variant: "gold", size: "lg" }),
                    "w-full sm:w-auto",
                  )}
                >
                  Score another idea
                </button>
                <Link
                  to="/"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "lg" }),
                    "w-full sm:w-auto",
                  )}
                >
                  Back to homepage
                </Link>
              </div>

              {/* History */}
              {mounted && recent.length > 0 && (
                <section className="mt-14 border-t border-ink-line pt-8">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-[15px] font-semibold tracking-tight text-fg">
                      Recent ideas
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        clearStoredHistory()
                        setHistory([])
                      }}
                      className={cn(
                        "rounded-full px-2 py-1 text-[12px] text-fg-muted transition-colors hover:text-fg",
                        focusRing,
                      )}
                    >
                      Clear history
                    </button>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {recent.map((entry) => {
                      const past = scoreIdea(entry)
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => loadEntry(entry)}
                            className={cn(
                              "flex w-full items-center gap-4 rounded-xl border border-ink-line bg-ink-card px-4 py-3 text-left transition-colors hover:border-white/20",
                              focusRing,
                            )}
                          >
                            <span className="font-display text-[16px] font-bold tabular-nums text-gold">
                              {past.score}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] text-fg">
                                {entry.idea}
                              </span>
                              <span className="mt-0.5 block text-[12px] text-fg-muted">
                                {past.band}
                                {" · "}
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}
              </>
            )}
        </motion.div>
      </div>
    </main>
  )
}
