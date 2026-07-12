import { ArrowUpRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { CAL_ATTRS } from "@/lib/cal"
import { Reveal } from "@/components/ui/reveal"

export function FinalCTA() {
  return (
    <section id="apply" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] border border-gold/20 bg-gradient-to-b from-ink-card to-ink px-8 py-20 text-center sm:px-16 sm:py-28">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-1/3 h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(232,192,120,0.18),transparent_60%)]"
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-balance font-display text-4xl font-bold leading-[1.05] tracking-tight text-fg sm:text-5xl md:text-6xl">
                Build the brand.
                <br />
                Skip the{" "}
                <span className="font-sans font-medium italic text-gold-gradient">
                  busywork
                </span>
                .
              </h2>
              <p className="mx-auto mt-6 max-w-lg text-[15px] leading-relaxed text-fg-muted sm:text-base">
                Done for you from scratch, whether you start at zero or already
                have an audience. One hour a week from you. Everything else from
                us.
              </p>
              <div className="mt-10">
                <a
                  {...CAL_ATTRS}
                  href="#apply"
                  className={buttonVariants({ variant: "gold", size: "lg" })}
                >
                  Apply to work with us
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-5 text-[13px] text-fg-muted/70">
                Results guaranteed. Limited studio capacity.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
