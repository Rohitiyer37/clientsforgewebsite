import { Reveal } from "@/components/ui/reveal"
import { ImageMarquee } from "@/components/ui/image-marquee"

const proofImages = [
  { src: "/calendly-fit.png", alt: "Calendly: 217 created events, +200 booked calls" },
  { src: "/stats2-fit.png", alt: "Channel growth after applying the system" },
  { src: "/stats4-fit.png", alt: "458.9K views and 16.4K new subscribers" },
  { src: "/stats3-fit.png", alt: "2.6M impressions in the last 28 days" },
  { src: "/stats6-fit.png", alt: "262,474 views in the last 28 days" },
]

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
