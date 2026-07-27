import { Reveal } from "@/components/ui/reveal"
import { ImageMarquee } from "@/components/ui/image-marquee"
import { proofImages } from "@/data/proof"

export function Positioning() {
  return (
    <section id="results" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">
            Results, not vanity metrics
          </p>
          <h2 className="mt-5 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl md:text-[42px]">
            Most content agencies sell you views and likes. We guarantee
            results.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-fg-muted">
            Attention is easy to fake. These are real dashboards from this exact
            system, not vanity metrics.
          </p>
        </Reveal>
      </div>

      {/* Horizontal carousel of real result screenshots */}
      <Reveal className="mt-14 sm:mt-16">
        <ImageMarquee images={proofImages} direction="right" />
      </Reveal>
    </section>
  )
}
