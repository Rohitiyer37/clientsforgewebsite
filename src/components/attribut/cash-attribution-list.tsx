import { useEffect, useState } from "react"
import { Instagram, Youtube } from "lucide-react"

import { AnimatedList } from "@/components/ui/animated-list"
import { cn } from "@/lib/utils"

interface Attribution {
  title: string
  amount: string
  source: "Reel" | "YouTube"
  calls: number
}

/** Illustrative figures. Nothing here is a real client number. */
const attributions: Attribution[] = [
  {
    title: "The 3-call close framework",
    amount: "$41,800",
    source: "Reel",
    calls: 24,
  },
  {
    title: "I raised my price 4x",
    amount: "$36,500",
    source: "YouTube",
    calls: 19,
  },
  { title: "My 6am routine", amount: "$7,400", source: "Reel", calls: 5 },
  { title: "Cold DM teardown", amount: "$12,900", source: "Reel", calls: 8 },
  {
    title: "Why I fired a client",
    amount: "$22,100",
    source: "YouTube",
    calls: 11,
  },
]

function AttributionCard({ title, amount, source, calls }: Attribution) {
  const Icon = source === "YouTube" ? Youtube : Instagram

  return (
    <figure
      className={cn(
        "relative mx-auto w-full max-w-[430px] overflow-hidden rounded-2xl p-4",
        "border border-white/10 bg-white/[0.04] backdrop-blur-md",
        "transform-gpu transition-transform duration-200 ease-in-out hover:scale-[102%] motion-reduce:hover:scale-100",
        "[box-shadow:0_-20px_80px_-20px_rgba(242,84,45,0.18)_inset]",
      )}
    >
      <div className="flex flex-row items-center gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-ember/25 bg-ember/15 text-ember-light">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="flex min-w-0 flex-col">
          <figcaption className="truncate text-[14px] font-medium text-white">
            {title}
            <span className="ml-1.5 font-semibold text-ember-light">
              {amount}
            </span>
          </figcaption>
          <p className="mt-0.5 text-[12px] text-white/50">
            {source} <span className="mx-1">·</span> {calls} calls booked
          </p>
        </div>
      </div>
    </figure>
  )
}

export function CashAttributionList({ className }: { className?: string }) {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  return (
    <div
      className={cn(
        "relative flex h-[420px] w-full flex-col overflow-hidden p-2",
        className,
      )}
    >
      {reduce ? (
        <div className="flex flex-col items-center gap-4">
          {attributions.map((item) => (
            <AttributionCard key={item.title} {...item} />
          ))}
        </div>
      ) : (
        <AnimatedList delay={1800}>
          {attributions.map((item) => (
            <AttributionCard key={item.title} {...item} />
          ))}
        </AnimatedList>
      )}

      {!reduce && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0a0503] to-transparent"
        />
      )}
    </div>
  )
}
