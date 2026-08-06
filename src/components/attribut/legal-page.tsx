import { type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import { AttributNav } from "@/components/attribut/attribut-nav"
import { Footer } from "@/components/sections/footer"

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mt-9">
      <h2 className="font-display text-[19px] font-semibold tracking-tight text-white">
        {title}
      </h2>
      <div className="mt-2.5 space-y-3 text-[15px] leading-relaxed text-white/60">
        {children}
      </div>
    </section>
  )
}

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: ReactNode
}) {
  return (
    <>
      <AttributNav />

      <main className="relative min-h-screen bg-[#0a0503]">
        {/* Soft ember wash so the legal pages still feel like Attribut */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_50%_0%,rgba(242,84,45,0.16),transparent_65%)]"
        />

        <div className="relative mx-auto max-w-3xl px-6 pb-24 pt-36 sm:pt-44">
          <Link
            to="/attribut"
            className="inline-flex items-center gap-2 text-[13px] text-white/50 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Attribut
          </Link>

          <h1 className="mt-8 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-[13px] text-white/40">
            Last updated: {lastUpdated}
          </p>

          <div className="mt-6">{children}</div>

          <div className="mt-14 border-t border-white/10 pt-6">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/50">
              <Link
                to="/attribut/terms"
                className="transition-colors hover:text-white"
              >
                Terms and Conditions
              </Link>
              <Link
                to="/attribut/privacy"
                className="transition-colors hover:text-white"
              >
                Privacy Policy
              </Link>
              <Link to="/" className="transition-colors hover:text-white">
                Clientsforge
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
