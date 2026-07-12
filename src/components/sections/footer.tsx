import { Instagram, Youtube, Linkedin } from "lucide-react"

import { Wordmark } from "@/components/logo"

const socials = [
  { icon: Instagram, label: "Instagram", href: "#" },
  { icon: Youtube, label: "YouTube", href: "#" },
  { icon: Linkedin, label: "LinkedIn", href: "#" },
]

export function Footer() {
  return (
    <footer className="border-t border-ink-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <Wordmark />

        <p className="order-3 text-center text-[12px] text-fg-muted/70 sm:order-2">
          © {new Date().getFullYear()} Clientsforge. Brand Backend Studio.
        </p>

        <div className="order-2 flex items-center gap-3 sm:order-3">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              aria-label={s.label}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-fg-muted transition-colors hover:border-gold/30 hover:text-gold-light"
            >
              <s.icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
