import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { CommentEventDto, EventStatus } from "../../../shared/automation"
import { ApiError, api } from "../api"

const STATUS: Record<EventStatus, { label: string; className: string }> = {
  dm_sent: { label: "DM sent", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
  replied: { label: "Replied", className: "border-gold/30 bg-gold/10 text-gold-light" },
  processing: { label: "Sending", className: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  received: { label: "Queued", className: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
  failed: { label: "Failed", className: "border-red-400/30 bg-red-400/10 text-red-300" },
  skipped: { label: "Skipped", className: "border-white/15 bg-white/[0.04] text-fg-muted" },
  no_match: { label: "No match", className: "border-white/15 bg-white/[0.04] text-fg-muted" },
}

function describe(e: CommentEventDto): string | null {
  if (e.error) return e.error
  if (e.status === "dm_sent") {
    return e.publicReplyStatus === "sent" ? "Replied publicly and sent the DM." : "Sent the DM."
  }
  if (e.status === "skipped") return "Skipped because this comment came from your own account."
  return null
}

function when(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function ActivityLog({ automationId }: { automationId: string }) {
  const [events, setEvents] = useState<CommentEventDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ events: CommentEventDto[] }>(
        `/api/automations/${automationId}/events`,
      )
      setEvents(res.events)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load activity.")
    } finally {
      setLoading(false)
    }
  }, [automationId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-fg-muted">Last 100 comments this automation handled.</p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <RefreshCw className={cn(loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5 text-center text-[14px] text-fg">
          {error}
        </p>
      ) : events === null ? (
        <div className="flex justify-center py-12" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-gold-light" />
          <span className="sr-only">Loading</span>
        </div>
      ) : events.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center text-[14px] text-fg-muted">
          No comments handled yet. When someone comments on this post, it shows up here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-ink-card/60">
          {events.map((e) => {
            const s = STATUS[e.status]
            const detail = describe(e)
            return (
              <li key={e.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[14px] text-fg">
                    <span className="font-semibold">@{e.commenterUsername ?? "unknown"}</span>
                    <span className="text-fg-muted"> commented </span>
                    <span className="break-words">“{e.commentText || "(no text)"}”</span>
                  </p>
                  {detail && <p className="mt-1 text-[13px] text-fg-muted">{detail}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-medium", s.className)}>
                    {s.label}
                  </span>
                  <span className="text-[12px] text-fg-muted/70">{when(e.receivedAt)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
