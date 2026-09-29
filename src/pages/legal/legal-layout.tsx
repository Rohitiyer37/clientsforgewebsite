import { useEffect, type ReactNode } from "react"
import { Link } from "react-router-dom"

import { Footer } from "@/components/sections/footer"

/**
 * PLACEHOLDERS: replace before submitting for Meta App Review. Every legal
 * page reads these, so they only need changing here.
 */
export const LEGAL_CONTACT_EMAIL = "[CONTACT EMAIL]"
export const LEGAL_ENTITY_NAME = "[LEGAL ENTITY NAME]"
export const LEGAL_LAST_UPDATED = "28 September 2026"

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-amber-300/20 px-1 text-amber-200">{children}</mark>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold tracking-tight text-fg">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-fg-muted [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-fg">
        {children}
      </div>
    </section>
  )
}

export function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    const previous = document.title
    document.title = `${title} | Clientsforge`
    return () => {
      document.title = previous
    }
  }, [title])

  return (
    <>
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-6">
          <Link to="/" className="font-display text-[17px] font-bold tracking-tight text-fg">
            Clientsforge
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14">
        <h1 className="font-display text-4xl font-bold tracking-tight text-fg sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 text-[13px] text-fg-muted">Last updated {LEGAL_LAST_UPDATED}</p>
        {intro && <div className="mt-6 text-[15px] leading-relaxed text-fg-muted">{intro}</div>}
        {children}
      </main>
      <Footer />
    </>
  )
}
