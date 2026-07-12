import { useEffect, useState } from "react"
import { motion } from "framer-motion"

import { buttonVariants } from "@/components/ui/button"
import { CAL_ATTRS } from "@/lib/cal"
import { cn } from "@/lib/utils"

const links = [
  { label: "How it works", href: "#process" },
  { label: "Attribution", href: "#attribution" },
  { label: "Results", href: "#results" },
]

export function Navbar() {
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
          "grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center rounded-full border px-5 py-2.5 transition-all duration-300 sm:px-6",
          scrolled
            ? "glass border-white/10 shadow-card"
            : "border-transparent bg-transparent",
        )}
      >
        <a
          href="#top"
          className="justify-self-start font-display text-lg font-bold tracking-tight text-fg"
        >
          Clientsforge
        </a>

        <div className="hidden items-center gap-8 justify-self-center md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[14px] text-fg-muted transition-colors hover:text-fg"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          {...CAL_ATTRS}
          href="#apply"
          className={cn(
            buttonVariants({ variant: "gold", size: "sm" }),
            "justify-self-end",
          )}
        >
          Book a call
        </a>
      </nav>
    </motion.header>
  )
}
