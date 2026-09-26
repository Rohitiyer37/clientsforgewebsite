import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowUpRight, BookOpen, Sparkles, Workflow, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useClient } from "@/dashboard/session"

interface CardSpec {
  title: string
  subtitle: string
  icon: LucideIcon
  to?: string
  badge?: string
}

const cards: CardSpec[] = [
  {
    title: "Automations",
    subtitle: "Auto-DM people who comment on your reels.",
    icon: Workflow,
    to: "/dashboard/automations",
  },
  {
    title: "SOPs & Frameworks",
    subtitle: "Every playbook we run for you, in one place.",
    icon: BookOpen,
    badge: "Coming soon",
  },
  {
    title: "Coming soon",
    subtitle: "More tools are on the way.",
    icon: Sparkles,
    badge: "Coming soon",
  },
  {
    title: "Coming soon",
    subtitle: "More tools are on the way.",
    icon: Sparkles,
    badge: "Coming soon",
  },
]

export default function DashboardHome() {
  const client = useClient()

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
          Hey {client.name} 👋
        </h1>
        <p className="mt-2 text-[15px] text-fg-muted">Welcome to your Clientsforge workspace.</p>
      </motion.div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map((card, i) => (
          <motion.div
            key={`${card.title}-${i}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 * (i + 1) }}
          >
            <DashboardCard {...card} />
          </motion.div>
        ))}
      </div>
    </>
  )
}

function DashboardCard({ title, subtitle, icon: Icon, to, badge }: CardSpec) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl border",
            to
              ? "border-gold/30 bg-gold/10 text-gold-light"
              : "border-white/[0.08] bg-white/[0.03] text-fg-muted/60",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        {to ? (
          <ArrowUpRight className="h-5 w-5 text-fg-muted transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold-light" />
        ) : (
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-fg-muted/70">
            {badge}
          </span>
        )}
      </div>
      <h2
        className={cn(
          "mt-8 font-display text-xl font-semibold tracking-tight",
          to ? "text-fg" : "text-fg-muted/60",
        )}
      >
        {title}
      </h2>
      <p className={cn("mt-1.5 text-[14px] leading-relaxed", to ? "text-fg-muted" : "text-fg-muted/45")}>
        {subtitle}
      </p>
    </>
  )

  const base = "block h-full min-h-[190px] rounded-3xl border p-6 sm:p-7"

  if (!to) {
    return (
      <div aria-disabled="true" className={cn(base, "cursor-not-allowed border-white/[0.05] bg-ink-card/40")}>
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
