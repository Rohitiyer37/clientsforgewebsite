import { motion } from "framer-motion"

import { Reveal } from "@/components/ui/reveal"

export function OneHour() {
  return (
    <section id="one-hour" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-card px-8 py-16 text-center sm:px-16 sm:py-24">
            {/* glow */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(201,162,75,0.16),transparent_65%)] blur-2xl"
            />
            <div className="relative">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">
                Your total time commitment
              </p>

              <div className="mt-6 flex items-baseline justify-center gap-3">
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="font-display text-[88px] font-bold leading-none tracking-tighter text-gold-gradient sm:text-[128px]"
                >
                  1
                </motion.span>
                <span className="text-3xl font-light text-fg-muted sm:text-5xl">
                  hour
                </span>
                <span className="self-end pb-3 text-lg text-fg-muted sm:text-2xl">
                  a week
                </span>
              </div>

              <h2 className="mx-auto mt-8 max-w-2xl text-balance font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:text-3xl">
                That is all it costs you. Everything else is managed by us.
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-fg-muted">
                No editing, no scripting, no chasing a content calendar. You show
                up for about an hour, and the studio runs the rest.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
