import { Radar, Check } from "lucide-react"

import { Reveal } from "@/components/ui/reveal"

const attributed = [
  { content: "“0 to launch” founder story", revenue: "$48,200", pct: 100 },
  { content: "Offer breakdown carousel", revenue: "$31,700", pct: 66 },
  { content: "Client result walkthrough", revenue: "$22,400", pct: 47 },
  { content: "Objection-handling reel", revenue: "$14,900", pct: 31 },
]

const points = [
  "Every piece of content is tracked to the revenue it creates",
  "No guessing which post, hook, or format is actually working",
  "The system doubles down on what drives calls, not what drives likes",
]

export function Attribution() {
  return (
    <section id="attribution" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-card/60 px-4 py-1.5 text-[12px] text-gold-light">
              <Radar className="h-3.5 w-3.5" />
              Proprietary attribution
            </span>
            <h2 className="mt-6 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl md:text-[42px]">
              Know exactly which content drives revenue.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-fg-muted">
              Our attribution system ties every piece of content to the money it
              produces, so you never have to guess what is working. Decisions get
              made on revenue, not reach.
            </p>

            <ul className="mt-8 space-y-3.5">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold-light">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-[14px] leading-relaxed text-fg-muted">
                    {p}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="card-surface relative overflow-hidden p-6 shadow-card">
              <div className="absolute inset-x-0 top-0 h-px hairline" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] text-fg-muted">
                    Revenue attributed this month
                  </div>
                  <div className="mt-1 font-display text-3xl font-bold tracking-tight text-fg">
                    $182,400
                  </div>
                </div>
                <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-gold-light">
                  Live tracking
                </span>
              </div>

              <div className="mt-7 space-y-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
                  Top revenue-driving content
                </div>
                {attributed.map((row) => (
                  <div key={row.content}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="truncate text-[13px] text-fg">
                        {row.content}
                      </span>
                      <span className="ml-3 text-[13px] font-medium text-gold-light">
                        {row.revenue}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-gold-gradient-135"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
