import { Navbar } from "@/components/sections/navbar"
import { Hero } from "@/components/sections/hero"
import { Positioning } from "@/components/sections/positioning"
import { Process } from "@/components/sections/process"
import { OneHour } from "@/components/sections/one-hour"
import { Attribution } from "@/components/sections/attribution"
import { FinalCTA } from "@/components/sections/final-cta"
import { Footer } from "@/components/sections/footer"

export default function Home() {
  return (
    <>
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
    </>
  )
}
