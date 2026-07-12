import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/clientsforge-logo.png"
      alt="Clientsforge"
      className={cn("h-8 w-auto object-contain", className)}
      draggable={false}
    />
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark className="h-11 w-auto" />
      <span className="text-[19px] font-semibold tracking-tight text-fg">
        Clientsforge
      </span>
    </div>
  )
}
