import { useState, type FormEvent } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Check, Loader2 } from "lucide-react"

import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Status = "idle" | "submitting" | "error" | "success"

interface WaitlistFormProps {
  className?: string
  /** Distinguishes the hero form from the closing form for label targeting. */
  id: string
  /** Recorded on the row so we can tell which form converted. */
  source?: string
  buttonLabel?: string
}

export function WaitlistForm({
  className,
  id,
  source = "attribut_landing",
  buttonLabel = "Join waitlist",
}: WaitlistFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")
  const [badField, setBadField] = useState<"name" | "email" | null>(null)

  function fail(field: "name" | "email" | null, text: string) {
    setBadField(field)
    setMessage(text)
    setStatus("error")
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === "submitting") return

    const cleanName = name.trim()
    const cleanEmail = email.trim()

    if (cleanName.length < 2) {
      fail("name", "Please enter your name.")
      return
    }
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      fail("email", "Please enter a valid email address.")
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      fail(null, "Signups are not configured yet. Please try again later.")
      return
    }

    setStatus("submitting")
    setBadField(null)

    const { error } = await supabase
      .from("waitlist")
      .insert({ name: cleanName, email: cleanEmail, source })

    if (error) {
      // 23505 is the unique violation, meaning this email already joined.
      if (error.code === "23505") {
        setStatus("success")
        return
      }
      fail(null, "Something went wrong. Please try again.")
      return
    }

    setStatus("success")
  }

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "mx-auto flex w-full max-w-xl items-center justify-center gap-3 rounded-2xl border border-ember/30 bg-ember/10 px-6 py-5 backdrop-blur-md",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ember text-[#0a0503]">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
        <p className="text-left text-[15px] text-white">
          You are on the list. We will email you when your invite is ready.
        </p>
      </motion.div>
    )
  }

  const busy = status === "submitting"

  return (
    <div className={cn("mx-auto w-full max-w-xl", className)}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor={`${id}-name`} className="sr-only">
              Your name
            </label>
            <input
              id={`${id}-name`}
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              disabled={busy}
              aria-invalid={badField === "name"}
              onChange={(e) => {
                setName(e.target.value)
                if (status === "error") setStatus("idle")
              }}
              className={cn(
                "h-14 w-full rounded-full border bg-white/[0.06] px-6 text-[15px] text-white backdrop-blur-md transition-colors placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-ember/50 disabled:opacity-60",
                badField === "name"
                  ? "border-ember/70"
                  : "border-white/15 hover:border-white/25",
              )}
            />
          </div>

          <div className="flex-1">
            <label htmlFor={id} className="sr-only">
              Email address
            </label>
            <input
              id={id}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@yourbrand.com"
              value={email}
              disabled={busy}
              aria-invalid={badField === "email"}
              onChange={(e) => {
                setEmail(e.target.value)
                if (status === "error") setStatus("idle")
              }}
              className={cn(
                "h-14 w-full rounded-full border bg-white/[0.06] px-6 text-[15px] text-white backdrop-blur-md transition-colors placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-ember/50 disabled:opacity-60",
                badField === "email"
                  ? "border-ember/70"
                  : "border-white/15 hover:border-white/25",
              )}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="group relative inline-flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-ember px-8 text-[15px] font-semibold text-[#160603] transition-transform duration-300 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ember/60 focus:ring-offset-2 focus:ring-offset-[#0a0503] disabled:opacity-70 motion-reduce:hover:scale-100"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-10 bg-[radial-gradient(circle,rgba(242,84,45,0.5),transparent_65%)] opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100 motion-reduce:hidden"
          />
          {busy ? (
            <>
              <Loader2 className="relative h-4 w-4 animate-spin" />
              <span className="relative">Joining</span>
            </>
          ) : (
            <>
              <span className="relative">{buttonLabel}</span>
              <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
            </>
          )}
        </button>
      </form>

      {status === "error" && (
        <p
          role="alert"
          className="mt-3 text-center text-[13px] text-ember-light"
        >
          {message}
        </p>
      )}
    </div>
  )
}
