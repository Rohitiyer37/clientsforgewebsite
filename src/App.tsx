import { useEffect } from "react"
import { Route, Routes } from "react-router-dom"

import { initCalEmbed } from "@/lib/cal"
import Home from "@/pages/home"
import WorkWithMe from "@/pages/work-with-me"

export default function App() {
  useEffect(() => {
    initCalEmbed()
  }, [])

  return (
    <div className="relative min-h-screen bg-ink">
      {/* subtle top grain / vignette */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(139,111,46,0.10),transparent_45%)]"
      />
      <div className="relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workwithme" element={<WorkWithMe />} />
        </Routes>
      </div>
    </div>
  )
}
