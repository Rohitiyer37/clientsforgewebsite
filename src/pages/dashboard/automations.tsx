import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, ImageOff, Loader2, Plus, Workflow } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { triggerSummary, type AutomationDto } from "../../../shared/automation"
import { ApiError, api } from "@/dashboard/api"
import { AccountCard, type ConnectedAccount } from "@/dashboard/automations/account-card"
import { Toggle } from "@/dashboard/automations/toggle"
import { useToast } from "@/dashboard/toast"

/** Messages for the ?ig= result the OAuth callback redirects back with. */
const CONNECT_RESULTS: Record<string, { tone: "success" | "error"; message: string }> = {
  connected: { tone: "success", message: "Instagram connected. You can create automations now." },
  denied: { tone: "error", message: "The Instagram connection was cancelled. Nothing was changed." },
  state: { tone: "error", message: "That connection attempt expired. Please try again." },
  not_professional: {
    tone: "error",
    message:
      "This is a personal Instagram account. In Instagram, go to Settings, then Account type and tools, switch to a Creator or Business account, and connect again.",
  },
  in_use: {
    tone: "error",
    message: "This Instagram account is already connected to another Clientsforge workspace.",
  },
  permissions: {
    tone: "error",
    message: "Automations need every permission Instagram asks for. Connect again and allow them all.",
  },
  failed: { tone: "error", message: "Instagram connection failed. Please try again." },
}

export default function AutomationsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [account, setAccount] = useState<ConnectedAccount | null>(null)
  const [automations, setAutomations] = useState<AutomationDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const [acc, list] = await Promise.all([
        api<{ account: ConnectedAccount | null }>("/api/instagram/account"),
        api<{ automations: AutomationDto[] }>("/api/automations"),
      ])
      setAccount(acc.account)
      setAutomations(list.automations)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load your automations.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Show the OAuth result once, then drop it from the URL.
  useEffect(() => {
    const result = params.get("ig")
    if (!result) return
    const entry = CONNECT_RESULTS[result] ?? CONNECT_RESULTS.failed
    if (entry) toast(entry.tone, entry.message)
    params.delete("ig")
    setParams(params, { replace: true })
  }, [params, setParams, toast])

  async function toggle(automation: AutomationDto, next: boolean) {
    setPending((s) => new Set(s).add(automation.id))
    try {
      const res = await api<{ automation: AutomationDto }>(`/api/automations/${automation.id}`, {
        method: "PATCH",
        body: { isActive: next },
      })
      setAutomations((list) => list.map((a) => (a.id === automation.id ? res.automation : a)))
      toast("success", next ? "Automation is live." : "Automation paused.")
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Could not update the automation.")
    } finally {
      setPending((s) => {
        const copy = new Set(s)
        copy.delete(automation.id)
        return copy
      })
    }
  }

  const canCreate = account?.status === "active"

  return (
    <>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-lg text-[13px] text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Workspace
      </Link>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            Automations
          </h1>
          <p className="mt-2 text-[15px] text-fg-muted">
            Auto-DM people who comment on your reels.
          </p>
        </div>
        {canCreate && automations.length > 0 && (
          <Link
            to="/dashboard/automations/new"
            className={cn(buttonVariants({ variant: "gold" }), "self-start sm:self-auto")}
          >
            <Plus />
            New automation
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-gold-light" />
          <span className="sr-only">Loading</span>
        </div>
      ) : loadError ? (
        <div className="mt-10 rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-6 text-center">
          <p className="text-[15px] text-fg">{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <AccountCard
            account={account}
            onDisconnected={() => {
              setLoading(true)
              void load()
            }}
          />

          {automations.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/[0.1] px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-light">
                <Workflow className="h-6 w-6" />
              </span>
              <h2 className="mt-5 font-display text-xl font-semibold text-fg">
                No automations yet
              </h2>
              <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-fg-muted">
                {canCreate
                  ? "Pick a reel, choose which comments to respond to, and write the DM they get."
                  : "Connect Instagram above, then create your first automation."}
              </p>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/automations/new")}
                  className={cn(buttonVariants({ variant: "gold" }), "mt-6")}
                >
                  <Plus />
                  Create your first automation
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {automations.map((a) => (
                <li key={a.id}>
                  <AutomationRow
                    automation={a}
                    busy={pending.has(a.id)}
                    canActivate={canCreate}
                    onToggle={(next) => void toggle(a, next)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "bad" }) {
  return (
    <div className="min-w-[64px]">
      <p
        className={cn(
          "font-display text-[17px] font-semibold tabular-nums",
          tone === "bad" && value > 0 ? "text-red-300" : "text-fg",
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-fg-muted">{label}</p>
    </div>
  )
}

function AutomationRow({
  automation: a,
  busy,
  canActivate,
  onToggle,
}: {
  automation: AutomationDto
  busy: boolean
  canActivate: boolean
  onToggle: (next: boolean) => void
}) {
  const [broken, setBroken] = useState(false)

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-white/[0.08] bg-ink-card/80 p-4 transition-colors hover:border-white/[0.14] sm:flex-row sm:items-center sm:p-5">
      <Link
        to={`/dashboard/automations/${a.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          {a.mediaThumbnailUrl && !broken ? (
            <img
              src={a.mediaThumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-fg-muted/50">
              <ImageOff className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-[16px] font-semibold text-fg">{a.name}</p>
          <p className="mt-0.5 truncate text-[13px] text-fg-muted">{triggerSummary(a)}</p>
        </div>
      </Link>

      <div className="flex items-center justify-between gap-6 sm:justify-end">
        <div className="flex gap-5">
          <Stat label="Matched" value={a.stats.matched} />
          <Stat label="DMs sent" value={a.stats.dmsSent} />
          <Stat label="Failed" value={a.stats.failures} tone="bad" />
        </div>
        <Toggle
          checked={a.isActive}
          busy={busy}
          disabled={!a.isActive && !canActivate}
          label={a.isActive ? `Pause ${a.name}` : `Activate ${a.name}`}
          onChange={onToggle}
        />
      </div>
    </div>
  )
}
