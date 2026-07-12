import { useEffect, useRef, useState } from "react"
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValueEvent,
  type MotionValue,
} from "framer-motion"
import {
  Compass,
  Filter,
  ScrollText,
  Palette,
  MessagesSquare,
  Workflow,
  type LucideIcon,
} from "lucide-react"

import { Reveal } from "@/components/ui/reveal"

type Step = {
  n: string
  icon: LucideIcon
  title: string
  desc: string
  img: string
}

const steps: Step[] = [
  {
    n: "01",
    icon: Compass,
    title: "Building the foundations",
    desc: "Positioning, offer, and brand architecture set from scratch so everything after it compounds.",
    img: "/foundations.png",
  },
  {
    n: "02",
    icon: Filter,
    title: "Building the funnels",
    desc: "The full path from first view to booked call, engineered and wired together for you.",
    img: "/funnels.png",
  },
  {
    n: "03",
    icon: ScrollText,
    title: "Writing the sequences",
    desc: "Sales and legal sequences written end to end, ready to convert without you touching a doc.",
    img: "/sequences.png",
  },
  {
    n: "04",
    icon: Palette,
    title: "Producing the assets",
    desc: "Every marketing asset your brand needs, designed and produced to a studio standard.",
    img: "/assets.png",
  },
  {
    n: "05",
    icon: MessagesSquare,
    title: "Writing the DM sales flows",
    desc: "The DM sales sequences that turn attention into conversations and conversations into calls.",
    img: "/dm-flows.png",
  },
  {
    n: "06",
    icon: Workflow,
    title: "Setting up automations",
    desc: "Every automation the system needs, configured and running quietly in the background.",
    img: "/automations.png",
  },
]

function StepImage({ step }: { step: Step }) {
  return (
    <div className="relative mx-auto w-full">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle,rgba(232,192,120,0.16),transparent_70%)] blur-2xl"
      />
      <div className="relative rounded-2xl border border-white/10 bg-ink-card p-2 shadow-card">
        <img
          src={step.img}
          alt={step.title}
          draggable={false}
          className="mx-auto block h-auto max-h-[54vh] w-auto max-w-full rounded-xl"
        />
      </div>
    </div>
  )
}

function StepText({ step, total }: { step: Step; total: number }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold-light">
          <step.icon className="h-5 w-5" />
        </span>
        <span className="font-display text-sm font-medium tabular-nums text-fg-muted">
          <span className="text-gold-light">{step.n}</span> / {String(total).padStart(2, "0")}
        </span>
      </div>
      <h3 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-fg sm:text-5xl md:text-6xl">
        {step.title}
      </h3>
      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-fg-muted sm:text-base">
        {step.desc}
      </p>
    </div>
  )
}

/** One full-screen service card; crossfades + slides based on its scroll slot. */
function StepPanel({
  progress,
  index,
  total,
  step,
}: {
  progress: MotionValue<number>
  index: number
  total: number
  step: Step
}) {
  const seg = 1 / total
  const start = index * seg
  const end = (index + 1) * seg
  const fade = seg * 0.32
  const isFirst = index === 0
  const isLast = index === total - 1

  const inA = start + (isFirst ? 0.00001 : fade)
  const outA = end - (isLast ? 0.00001 : fade)

  const opacity = useTransform(
    progress,
    [start, inA, outA, end],
    [isFirst ? 1 : 0, 1, 1, isLast ? 1 : 0],
  )
  const y = useTransform(
    progress,
    [start, inA, outA, end],
    [isFirst ? 0 : 60, 0, 0, isLast ? 0 : -60],
  )

  return (
    <motion.div
      style={{ opacity, y }}
      className="pointer-events-none absolute inset-0 flex items-center"
    >
      <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 lg:order-1">
          <StepText step={step} total={total} />
        </div>
        <div className="order-1 lg:order-2">
          <StepImage step={step} />
        </div>
      </div>
    </motion.div>
  )
}

function StepCounter({
  progress,
  total,
}: {
  progress: MotionValue<number>
  total: number
}) {
  const [n, setN] = useState(1)
  useMotionValueEvent(progress, "change", (v) => {
    setN(Math.max(1, Math.min(total, Math.floor(v * total) + 1)))
  })
  return (
    <span className="font-display text-sm font-medium tabular-nums text-fg-muted">
      <span className="text-gold-light">{String(n).padStart(2, "0")}</span> /{" "}
      {String(total).padStart(2, "0")}
    </span>
  )
}

/** Mobile / reduced-motion fallback: a simple stacked list, no pinning. */
function ProcessStatic() {
  return (
    <section id="process" className="relative py-24">
      <div className="mx-auto max-w-2xl px-6">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">
            Everything else, handled
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            The full brand backend, built and run for you
          </h2>
        </div>
        <div className="mt-12 space-y-14">
          {steps.map((step) => (
            <Reveal key={step.title}>
              <div>
                <StepImage step={step} />
                <div className="mt-6">
                  <StepText step={step} total={steps.length} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Process() {
  const trackRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  })
  const barScaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.4,
  })

  const [isMobile, setIsMobile] = useState(false)
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 1024)
    check()
    window.addEventListener("resize", check)
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
    const onReduce = () => setReduce(mq.matches)
    mq.addEventListener("change", onReduce)
    return () => {
      window.removeEventListener("resize", check)
      mq.removeEventListener("change", onReduce)
    }
  }, [])

  if (isMobile || reduce) return <ProcessStatic />

  return (
    <section id="process" className="relative">
      <div ref={trackRef} className="relative h-[600vh]">
        <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col px-6">
            {/* persistent top bar */}
            <div className="flex items-center justify-between pb-4 pt-28">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">
                Everything else, handled
              </p>
              <StepCounter progress={scrollYProgress} total={steps.length} />
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                style={{ scaleX: barScaleX }}
                className="h-full origin-left rounded-full bg-gold-gradient-135"
              />
            </div>

            {/* stacked full-screen cards */}
            <div className="relative flex-1">
              {steps.map((step, i) => (
                <StepPanel
                  key={step.title}
                  progress={scrollYProgress}
                  index={i}
                  total={steps.length}
                  step={step}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
