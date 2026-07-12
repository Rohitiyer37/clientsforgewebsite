import { useRef, type ReactNode } from "react"
import { motion, useMotionValue, useMotionTemplate } from "framer-motion"

import { cn } from "@/lib/utils"

interface SpotlightPanelProps {
  children: ReactNode
  className?: string
  /** Radius of the spotlight in px */
  radius?: number
}

export function SpotlightPanel({
  children,
  className,
  radius = 420,
}: SpotlightPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const mouseX = useMotionValue(-radius)
  const mouseY = useMotionValue(-radius)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }

  function handleMouseLeave() {
    mouseX.set(-radius)
    mouseY.set(-radius)
  }

  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${mouseX}px ${mouseY}px, rgba(232,192,120,0.14), rgba(255,255,255,0.05) 30%, transparent 65%)`

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("group relative overflow-hidden", className)}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
