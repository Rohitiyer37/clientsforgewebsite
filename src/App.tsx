import { Suspense, lazy, useEffect } from "react"
import { Route, Routes, useLocation } from "react-router-dom"

import { initCalEmbed } from "@/lib/cal"
import Home from "@/pages/home"
import WorkWithMe from "@/pages/work-with-me"

// The Attribut pages pull in Supabase and the WebGL gradient, so they are split
// out to keep the main Clientsforge bundle light.
const Attribut = lazy(() => import("@/pages/attribut"))
const AttributTerms = lazy(() => import("@/pages/attribut-terms"))
const AttributPrivacy = lazy(() => import("@/pages/attribut-privacy"))
const IdeationScorer = lazy(() => import("@/pages/ideation-scorer"))

/** Route changes should start at the top rather than keeping the old offset. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  useEffect(() => {
    initCalEmbed()

    // Warm the split Attribut chunk once the browser is idle so navigating
    // there never has to wait on a fetch or flash the Suspense fallback.
    const warm = () => {
      void import("@/pages/attribut")
    }
    const w = window as typeof window & {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(warm)
      return () => w.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(warm, 2000)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="relative min-h-screen bg-ink">
      {/* subtle top grain / vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(139,111,46,0.10),transparent_45%)]"
      />
      <div className="relative z-10">
        <ScrollToTop />
        <Suspense fallback={<div className="min-h-screen bg-ink" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/workwithme" element={<WorkWithMe />} />
            <Route path="/attribut" element={<Attribut />} />
            <Route path="/attribut/terms" element={<AttributTerms />} />
            <Route path="/attribut/privacy" element={<AttributPrivacy />} />
            <Route path="/ideationscorer" element={<IdeationScorer />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}
