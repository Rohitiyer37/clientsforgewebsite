import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { WistiaVideo } from "@/components/ui/wistia-video"
import { ImageMarquee } from "@/components/ui/image-marquee"
import { Reveal } from "@/components/ui/reveal"
import { Process } from "@/components/sections/process"
import { Footer } from "@/components/sections/footer"
import { proofImages } from "@/data/proof"
import { CAL_ATTRS } from "@/lib/cal"
import { cn } from "@/lib/utils"

function MinimalNav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={cn(
          "flex w-full max-w-5xl items-center justify-between rounded-full border px-5 py-2.5 transition-all duration-300 sm:px-6",
          scrolled
            ? "glass border-white/10 shadow-card"
            : "border-transparent bg-transparent",
        )}
      >
        <Link
          to="/"
          className="font-display text-lg font-bold tracking-tight text-fg"
        >
          Clientsforge
        </Link>
        <a
          {...CAL_ATTRS}
          href="#talk"
          className={buttonVariants({ variant: "gold", size: "sm" })}
        >
          Talk with us
        </a>
      </nav>
    </motion.header>
  )
}

function TalkButton({ className }: { className?: string }) {
  return (
    <a
      {...CAL_ATTRS}
      href="#talk"
      className={cn(buttonVariants({ variant: "gold", size: "lg" }), className)}
    >
      Talk with us
      <ArrowUpRight className="h-4 w-4" />
    </a>
  )
}

export default function WorkWithMe() {
  return (
    <>
      <MinimalNav />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pb-28 pt-28 sm:pb-36 sm:pt-32">
          {/* Animated aurora gradient (same treatment as the main site) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              className="absolute left-1/2 top-[30%] h-[860px] w-[860px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-3xl animate-aurora-spin"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(232,192,120,0) 0deg, rgba(232,192,120,0.55) 90deg, rgba(139,111,46,0.18) 200deg, rgba(232,192,120,0) 360deg)",
              }}
            />
            <div className="absolute right-[10%] top-[10%] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(232,192,120,0.14),transparent_65%)] blur-2xl animate-glow-drift" />
            <div className="absolute left-[8%] top-[34%] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(139,111,46,0.16),transparent_65%)] blur-2xl animate-glow-drift [animation-delay:-8s]" />
          </div>

          {/* Ambient orb */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[28%] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(232,192,120,0.22),rgba(201,162,75,0.08)_38%,transparent_70%)] blur-[40px] animate-orb-drift"
          />
          {/* Edge gradient bleed */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(139,111,46,0.12),transparent_35%),radial-gradient(circle_at_100%_10%,rgba(232,192,120,0.10),transparent_40%)]"
          />
          {/* Fade the ambient light into the page background so the section
              boundary never reads as a hard line */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent to-ink"
          />

          <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-sm font-medium uppercase tracking-[0.2em] text-gold"
            >
              For Coaches and Agency Owners
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mx-auto mt-6 max-w-4xl text-balance font-display text-4xl font-bold leading-[1.06] tracking-tight text-fg sm:text-6xl md:text-[68px]"
            >
              Book an extra{" "}
              <span className="font-sans font-medium italic text-gold-gradient">
                10+ sales calls
              </span>{" "}
              using our organic sales systems
            </motion.h1>

            {/* Video */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.25,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-14"
            >
              <WistiaVideo />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-12"
            >
              <TalkButton />
            </motion.div>
          </div>
        </section>

        {/* Results carousel */}
        <section className="relative pb-24 pt-12 sm:pb-28 sm:pt-16">
          <Reveal className="mx-auto max-w-3xl px-6 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">
              Results, not vanity metrics
            </p>
            <h2 className="mt-4 text-balance font-display text-2xl font-bold leading-tight tracking-tight text-fg sm:text-3xl">
              Real dashboards from this exact system
            </h2>
          </Reveal>

          <Reveal className="mt-12">
            <ImageMarquee images={proofImages} direction="right" />
          </Reveal>
        </section>

        {/* Process breakdown (same pinned animation as the main site) */}
        <Process />

        {/* Closing CTA */}
        <section id="talk" className="relative py-24 sm:py-32">
          <div className="mx-auto max-w-5xl px-6">
            <Reveal>
              <div className="relative overflow-hidden rounded-[32px] border border-gold/20 bg-gradient-to-b from-ink-card to-ink px-8 py-20 text-center sm:px-16 sm:py-24">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-1/3 h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(232,192,120,0.18),transparent_60%)]"
                />
                <div className="relative">
                  <h2 className="mx-auto max-w-2xl text-balance font-display text-3xl font-bold leading-[1.08] tracking-tight text-fg sm:text-4xl md:text-5xl">
                    Ready to book an extra{" "}
                    <span className="font-sans font-medium italic text-gold-gradient">
                      10+ sales calls
                    </span>
                    ?
                  </h2>
                  <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-fg-muted">
                    One hour a week from you. Everything else from us. Results
                    guaranteed.
                  </p>
                  <div className="mt-10">
                    <TalkButton />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
