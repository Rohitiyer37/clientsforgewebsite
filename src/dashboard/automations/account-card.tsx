import { useState } from "react"
import { AlertTriangle, Instagram, Loader2, RefreshCw, Unplug } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { ApiError, api } from "../api"
import { useToast } from "../toast"

export interface ConnectedAccount {
  username: string
  profilePictureUrl: string | null
  status: "active" | "expired" | "revoked"
  connectedAt: string
  tokenExpiresAt: string | null
}

/** Full page navigation: the connect route redirects to Instagram. */
function connect() {
  window.location.assign("/api/instagram/connect")
}

export function AccountCard({
  account,
  onDisconnected,
}: {
  account: ConnectedAccount | null
  onDisconnected: () => void
}) {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function disconnect() {
    setBusy(true)
    try {
      await api("/api/instagram/account", { method: "DELETE" })
      toast("success", "Instagram disconnected. Your automations are paused.")
      setConfirming(false)
      onDisconnected()
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Could not disconnect Instagram.")
    } finally {
      setBusy(false)
    }
  }

  if (!account) {
    return (
      <div className="flex flex-col gap-5 rounded-3xl border border-white/[0.08] bg-ink-card/80 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-light">
            <Instagram className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-[17px] font-semibold text-fg">Connect Instagram</p>
            <p className="mt-0.5 text-[14px] text-fg-muted">
              Link your Creator or Business account to start automating replies.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={connect}
          className={cn(buttonVariants({ variant: "gold" }), "shrink-0")}
        >
          <Instagram />
          Connect Instagram
        </button>
      </div>
    )
  }

  const expired = account.status === "expired"

  return (
    <div className="space-y-3">
      {expired && (
        <div
          role="alert"
          className="flex flex-col gap-4 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="text-[14px] font-medium text-fg">Reconnect Instagram</p>
              <p className="text-[13px] text-fg-muted">
                Instagram ended this connection, so automations cannot send anything until you
                reconnect.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={connect}
            className={cn(buttonVariants({ variant: "gold", size: "sm" }), "shrink-0")}
          >
            <RefreshCw />
            Reconnect
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5 rounded-3xl border border-white/[0.08] bg-ink-card/80 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          {account.profilePictureUrl ? (
            <img
              src={account.profilePictureUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-12 w-12 shrink-0 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-fg-muted">
              <Instagram className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-[17px] font-semibold text-fg">
              @{account.username}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-[13px] text-fg-muted">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  expired ? "bg-amber-400" : "bg-emerald-400",
                )}
              />
              {expired ? "Needs reconnecting" : "Connected"}
            </p>
          </div>
        </div>

        {confirming ? (
          <div className="flex flex-col gap-2 sm:items-end">
            <p className="text-[13px] text-fg-muted">
              Disconnect and pause every automation?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Keep connected
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={busy}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-red-500/90 text-white hover:bg-red-500",
                )}
              >
                {busy && <Loader2 className="animate-spin" />}
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 self-start sm:self-auto")}
          >
            <Unplug />
            Disconnect
          </button>
        )}
      </div>
    </div>
  )
}
