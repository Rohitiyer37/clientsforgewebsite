import { useEffect } from "react"

import { initCalEmbed } from "@/lib/cal"
import { Navbar } from "@/components/sections/navbar"
import { Hero } from "@/components/sections/hero"
import { Positioning } from "@/components/sections/positioning"
import { Process } from "@/components/sections/process"
import { OneHour } from "@/components/sections/one-hour"
import { Attribution } from "@/components/sections/attribution"
import { FinalCTA } from "@/components/sections/final-cta"
import { Footer } from "@/components/sections/footer"

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
        <Navbar />
        <main>
          <Hero />
          <Positioning />
          <Process />
          <OneHour />
          <Attribution />
          <FinalCTA />
        </main>
        <Footer />
      </div>
    </div>
  )
}
