import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, ArrowUpRight, Instagram, Youtube, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface Platform {
  name: string
  subtitle: string
  icon: LucideIcon
  to?: string
}

const platforms: Platform[] = [
  {
    name: "Instagram",
    subtitle: "Views, top reels, and how your content turns into followers and DMs.",
    icon: Instagram,
    to: "/dashboard/analytics/instagram",
  },
  {
    name: "YouTube",
    subtitle: "Channel analytics are on the way.",
    icon: Youtube,
  },
]

export default function AnalyticsPlatforms() {
  return (
    <>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-lg text-[13px] text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Workspace
      </Link>

      <div className="mt-5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          Content Analytics
        </h1>
        <p className="mt-2 text-[15px] text-fg-muted">
          See how your content turns into followers and DMs.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {platforms.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 * (i + 1) }}
          >
            <PlatformCard {...p} />
          </motion.div>
        ))}
      </div>
    </>
  )
}

function PlatformCard({ name, subtitle, icon: Icon, to }: Platform) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl border",
            to
              ? "border-gold/30 bg-gold/10 text-gold-light"
              : "border-white/[0.08] bg-white/[0.03] text-fg-muted/60",
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        {to ? (
          <ArrowUpRight className="h-5 w-5 text-fg-muted transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-light" />
        ) : (
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-fg-muted/70">
            Coming soon
          </span>
        )}
      </div>
      <h2
        className={cn(
          "mt-10 font-display text-2xl font-semibold tracking-tight",
          to ? "text-fg" : "text-fg-muted/60",
        )}
      >
        {name}
      </h2>
      <p
        className={cn(
          "mt-1.5 text-[14px] leading-relaxed",
          to ? "text-fg-muted" : "text-fg-muted/45",
        )}
      >
        {subtitle}
      </p>
    </>
  )

  const base = "block h-full min-h-[240px] rounded-3xl border p-6 sm:p-8"

  if (!to) {
    return (
      <div
        aria-disabled="true"
        className={cn(base, "cursor-not-allowed border-white/[0.05] bg-ink-card/40")}
      >
        {body}
      </div>
    )
  }
  return (
    <Link
      to={to}
      className={cn(
        base,
        "group border-white/[0.08] bg-ink-card/80 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/30 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
      )}
    >
      {body}
    </Link>
  )
}
