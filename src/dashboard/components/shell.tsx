import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Loader2, LogOut } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useDashboardSession } from "../session"

export function DashboardShell({ children }: { children: ReactNode }) {
  const { logout } = useDashboardSession()
  const [leaving, setLeaving] = useState(false)

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            to="/dashboard"
            className="flex items-baseline gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            <span className="font-display text-[17px] font-bold tracking-tight text-fg">
              Clientsforge
            </span>
            <span className="hidden text-[12px] text-fg-muted sm:inline">Workspace</span>
          </Link>

          <button
            type="button"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true)
              try {
                await logout()
              } finally {
                setLeaving(false)
              }
            }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {leaving ? <Loader2 className="animate-spin" /> : <LogOut />}
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">{children}</main>
    </div>
  )
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-gold-light" />
      <span className="sr-only">Loading</span>
    </div>
  )
}
