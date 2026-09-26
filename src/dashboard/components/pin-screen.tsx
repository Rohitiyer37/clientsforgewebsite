import { useState, type FormEvent } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { LoginSchema, PIN_FAILED_MESSAGE } from "../../../shared/auth"
import { ApiError, api } from "../api"
import { useDashboardSession, type DashboardClient } from "../session"

export function PinScreen() {
  const { signedIn } = useDashboardSession()
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const parsed = LoginSchema.safeParse({ pin })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? PIN_FAILED_MESSAGE)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ client: DashboardClient }>("/api/auth/login", {
        method: "POST",
        body: parsed.data,
      })
      setPin("")
      signedIn(res.client)
    } catch (err) {
      setPin("")
      setError(err instanceof ApiError ? err.message : PIN_FAILED_MESSAGE)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(232,192,120,0.14),transparent_68%)] blur-2xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        <p className="text-center font-display text-lg font-bold tracking-tight text-fg">
          Clientsforge
        </p>

        <div className="mt-8 rounded-[28px] border border-white/[0.08] bg-ink-card/80 p-7 shadow-card backdrop-blur-xl sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-light">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <h1 className="mt-5 text-center font-display text-2xl font-bold tracking-tight text-fg">
            Client Access
          </h1>
          <p className="mt-2 text-center text-[14px] text-fg-muted">
            Enter your personal VIP PIN to continue.
          </p>

          <form onSubmit={onSubmit} noValidate className="mt-7">
            <label htmlFor="pin" className="sr-only">
              VIP PIN
            </label>
            <input
              id="pin"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                if (error) setError(null)
              }}
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "pin-error" : undefined}
              placeholder="Your PIN"
              className={cn(
                "h-14 w-full rounded-2xl border bg-ink-raised/70 px-5 py-3.5 text-center text-[16px] tracking-[0.25em] text-fg placeholder:tracking-normal placeholder:text-fg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:opacity-60",
                error ? "border-red-400/50" : "border-white/10 hover:border-white/20",
              )}
            />

            <div className="min-h-[28px] pt-2.5" aria-live="polite">
              {error && (
                <p id="pin-error" role="alert" className="text-center text-[13px] text-red-300">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={busy || pin.length === 0}
              className={cn(buttonVariants({ variant: "gold", size: "lg" }), "mt-2 w-full")}
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" />
                  Checking
                </>
              ) : (
                <>
                  Enter workspace
                  <ArrowRight />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] text-fg-muted/60">
          Lost your PIN? Message your Clientsforge contact.
        </p>
      </motion.div>
    </main>
  )
}
