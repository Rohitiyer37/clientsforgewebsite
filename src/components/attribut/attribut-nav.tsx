import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

export function AttributNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={cn(
          "flex w-full max-w-5xl items-center justify-between rounded-full border px-5 py-2.5 transition-all duration-300 sm:px-6",
          scrolled
            ? "border-white/10 bg-black/50 shadow-card backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="flex items-baseline gap-2.5">
          <Link
            to="/attribut"
            className="font-accent text-[26px] italic leading-none text-white"
          >
            Attribut
          </Link>
          <Link
            to="/"
            className="hidden text-[11px] text-white/40 transition-colors hover:text-white/70 sm:block"
          >
            by Clientsforge
          </Link>
        </div>

        <a
          href="#waitlist"
          className="inline-flex h-9 items-center justify-center rounded-full bg-ember px-5 text-[13px] font-semibold text-[#160603] transition-transform duration-300 hover:scale-[1.04] motion-reduce:hover:scale-100"
        >
          Join waitlist
        </a>
      </nav>
    </motion.header>
  )
}
