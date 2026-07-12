import {
  LayoutDashboard,
  BarChart3,
  Users,
  MessageSquare,
  Megaphone,
  Settings,
} from "lucide-react"

import { LogoMark } from "@/components/logo"
import { cn } from "@/lib/utils"

function Sparkline({
  points,
  className,
}: {
  points: number[]
  className?: string
}) {
  const w = 100
  const h = 32
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p - min) / range) * h
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full", className)}
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E8C078" stopOpacity="0.28" />
          <stop offset="1" stopColor="#E8C078" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#spark-fill)" />
      <path
        d={d}
        fill="none"
        stroke="#E8C078"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StatCard({
  label,
  value,
  delta,
  points,
}: {
  label: string
  value: string
  delta: string
  points: number[]
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-ink-raised/70 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-fg-muted">{label}</span>
        <span className="text-[10px] font-medium text-gold-light">{delta}</span>
      </div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight text-fg">
        {value}
      </div>
      <div className="mt-2">
        <Sparkline points={points} />
      </div>
    </div>
  )
}

function Donut() {
  const segments = [
    { label: "Reels", value: 52, color: "#E8C078" },
    { label: "Stories", value: 26, color: "#C9A24B" },
    { label: "DMs", value: 14, color: "#8B6F2E" },
    { label: "Other", value: 8, color: "#3a3320" },
  ]
  const radius = 34
  const circ = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 90 90" className="h-24 w-24 -rotate-90">
        {segments.map((s) => {
          const len = (s.value / 100) * circ
          const el = (
            <circle
              key={s.label}
              cx="45"
              cy="45"
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth="11"
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[11px]">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-fg-muted">{s.label}</span>
            <span className="ml-auto font-medium text-fg">{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarList() {
  const items = [
    { label: "“0 to launch” founder story", value: 92 },
    { label: "Offer breakdown carousel", value: 74 },
    { label: "Client result walkthrough", value: 61 },
    { label: "Objection-handling reel", value: 48 },
  ]
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="truncate text-fg-muted">{it.label}</span>
            <span className="ml-2 font-medium text-fg">{it.value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gold-gradient-135"
              style={{ width: `${it.value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: BarChart3, label: "Analytics" },
  { icon: Users, label: "Leads" },
  { icon: MessageSquare, label: "Messages" },
  { icon: Megaphone, label: "Campaigns" },
  { icon: Settings, label: "Settings" },
]

const pipeline = [
  { stage: "New lead", count: 214 },
  { stage: "Contacted", count: 138 },
  { stage: "Qualified", count: 76 },
  { stage: "Closed", count: 29 },
]

export function DashboardMockup() {
  return (
    <div className="relative flex min-h-[440px] w-full bg-ink text-left">
      {/* Overlaid section headline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-5">
        <div className="rounded-full border border-white/10 bg-ink/70 px-5 py-2 backdrop-blur-sm">
          <span className="font-display text-sm font-bold tracking-tight text-fg sm:text-base">
            We handle everything <span className="text-gold-gradient">end to end</span>
          </span>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="hidden w-[168px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-card/60 p-4 sm:flex">
        <div className="flex items-center gap-2 pb-6">
          <LogoMark className="h-6 w-auto" />
          <span className="text-xs font-semibold text-fg">Studio OS</span>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px]",
                item.active
                  ? "bg-gold/[0.12] text-gold-light"
                  : "text-fg-muted",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </div>
          ))}
        </nav>
        <div className="mt-auto rounded-lg border border-white/[0.06] bg-ink-raised/60 p-3">
          <div className="text-[10px] text-fg-muted">Attribution</div>
          <div className="mt-0.5 text-sm font-semibold text-gold-light">
            Live
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 space-y-4 p-4 pt-16 sm:p-5 sm:pt-16">
        {/* Row 1: stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Content produced"
            value="97"
            delta="+18%"
            points={[8, 12, 10, 16, 20, 24, 28]}
          />
          <StatCard
            label="Sales calls booked"
            value="64"
            delta="+31%"
            points={[4, 6, 9, 8, 14, 18, 22]}
          />
          <StatCard
            label="Revenue attributed"
            value="$182k"
            delta="+42%"
            points={[10, 14, 13, 20, 26, 30, 38]}
          />
          <StatCard
            label="Conversion rate"
            value="7.4%"
            delta="+2.1pt"
            points={[12, 11, 14, 16, 15, 19, 21]}
          />
        </div>

        {/* Row 2: donut + barlist */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-ink-raised/70 p-4">
            <div className="mb-3 text-[11px] font-medium text-fg-muted">
              Content sources
            </div>
            <Donut />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-ink-raised/70 p-4">
            <div className="mb-3 text-[11px] font-medium text-fg-muted">
              Top content by revenue
            </div>
            <BarList />
          </div>
        </div>

        {/* Row 3: secondary stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { l: "New leads", v: "214" },
            { l: "Appointments", v: "138" },
            { l: "Deals closed", v: "29" },
            { l: "Pipeline value", v: "$410k" },
          ].map((s) => (
            <div
              key={s.l}
              className="rounded-xl border border-white/[0.06] bg-ink-raised/70 p-3.5"
            >
              <div className="text-[11px] text-fg-muted">{s.l}</div>
              <div className="mt-1 text-lg font-semibold text-fg">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Row 4: pipeline */}
        <div className="rounded-xl border border-white/[0.06] bg-ink-raised/70 p-4">
          <div className="mb-3 text-[11px] font-medium text-fg-muted">
            Sales pipeline
          </div>
          <div className="grid grid-cols-4 gap-2">
            {pipeline.map((p, i) => (
              <div key={p.stage} className="relative">
                <div className="rounded-lg border border-white/[0.06] bg-ink/60 px-3 py-2.5">
                  <div className="text-lg font-semibold text-fg">
                    {p.count}
                  </div>
                  <div className="text-[10px] text-fg-muted">{p.stage}</div>
                </div>
                {i < pipeline.length - 1 && (
                  <div className="absolute right-[-9px] top-1/2 z-10 hidden h-px w-4 -translate-y-1/2 bg-gradient-to-r from-gold/60 to-transparent lg:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
