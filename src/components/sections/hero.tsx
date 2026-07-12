import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { CAL_ATTRS } from "@/lib/cal"
import { ContainerScroll } from "@/components/ui/container-scroll-animation"
import { CursorGlow } from "@/components/ui/cursor-glow"
import { DashboardMockup } from "@/components/dashboard-mockup"

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-36 sm:pt-44">
      {/* Cursor glow, scoped to this section (hero through the dashboard) */}
      <CursorGlow />

      {/* Animated aurora gradient */}
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
        className="pointer-events-none absolute left-1/2 top-[32%] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(232,192,120,0.22),rgba(201,162,75,0.08)_38%,transparent_70%)] blur-[40px] animate-orb-drift"
      />
      {/* Edge gradient bleed */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(139,111,46,0.12),transparent_35%),radial-gradient(circle_at_100%_10%,rgba(232,192,120,0.10),transparent_40%)]"
      />

      {/* Watermark type */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[280px] z-0 select-none text-center"
      >
        <span className="text-[18vw] font-bold leading-none tracking-tighter text-white/[0.025] sm:text-[15vw]">
          FORGE
        </span>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-balance text-5xl font-bold leading-[1.05] tracking-tight text-fg sm:text-7xl md:text-[92px]"
        >
          Build the brand.
          <br />
          Skip the{" "}
          <span className="text-gold-gradient font-sans font-medium italic">
            busywork
          </span>
          .
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mx-auto mt-7 max-w-xl text-pretty text-[15px] leading-relaxed text-fg-muted sm:text-base"
        >
          We build and run your entire content and funnel system end to end.
          You give it about an hour a week. We handle everything else.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <a
            {...CAL_ATTRS}
            href="#apply"
            className={buttonVariants({ variant: "gold", size: "lg" })}
          >
            Book a call
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <a
            href="#process"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            See how it works
          </a>
        </motion.div>
      </div>

      {/* Scroll-driven dashboard reveal */}
      <ContainerScroll
        titleComponent={
          <div className="px-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold sm:text-sm">
              Inside the studio
            </p>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-fg sm:text-5xl md:text-6xl">
              One system. Every moving part,{" "}
              <span className="font-sans font-medium italic text-gold-gradient">
                handled
              </span>
              .
            </h2>
          </div>
        }
      >
        <DashboardMockup />
      </ContainerScroll>
    </section>
  )
}
