import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { CheckCircle2, Loader2, SearchX } from "lucide-react"

import { LEGAL_CONTACT_EMAIL, LegalLayout, Placeholder } from "./legal-layout"

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; completedAt: string | null }
  | { kind: "missing" }

/** The confirmation URL Meta shows users after a data deletion request. */
export default function DataDeletionStatus() {
  const [params] = useSearchParams()
  const code = params.get("code")
  const [state, setState] = useState<State>(code ? { kind: "loading" } : { kind: "idle" })

  useEffect(() => {
    if (!code) return
    const controller = new AbortController()
    fetch(`/api/instagram/data-deletion?code=${encodeURIComponent(code)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) return setState({ kind: "missing" })
        const body = (await res.json()) as { completedAt: string | null }
        setState({ kind: "found", completedAt: body.completedAt })
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setState({ kind: "missing" })
        }
      })
    return () => controller.abort()
  }, [code])

  return (
    <LegalLayout title="Data deletion">
      <div className="mt-10 rounded-3xl border border-white/[0.08] bg-ink-card/80 p-7">
        {state.kind === "loading" && (
          <p className="flex items-center gap-3 text-[15px] text-fg-muted" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-gold-light" />
            Checking your request
          </p>
        )}
        {state.kind === "found" && (
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-[16px] font-medium text-fg">Your data has been deleted.</p>
              <p className="mt-1 text-[14px] text-fg-muted">
                Confirmation code <span className="font-mono text-fg">{code}</span>
                {state.completedAt &&
                  `, completed ${new Date(state.completedAt).toLocaleString()}`}
                . We removed the connected account, its access token, its automations, and its
                comment records.
              </p>
            </div>
          </div>
        )}
        {state.kind === "missing" && (
          <div className="flex gap-3">
            <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted" />
            <p className="text-[15px] text-fg-muted">
              We could not find that confirmation code. Check the link Instagram gave you, or email{" "}
              <Placeholder>{LEGAL_CONTACT_EMAIL}</Placeholder>.
            </p>
          </div>
        )}
        {state.kind === "idle" && (
          <p className="text-[15px] leading-relaxed text-fg-muted">
            To delete your data, remove Clientsforge from Instagram under Settings, Website
            permissions, Apps and websites. You will get a confirmation link that shows the status
            here. For anything else, email <Placeholder>{LEGAL_CONTACT_EMAIL}</Placeholder>.
          </p>
        )}
      </div>
    </LegalLayout>
  )
}
