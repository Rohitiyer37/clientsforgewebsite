import { type ReactNode } from "react"
import { motion, type Variants } from "framer-motion"

import { cn } from "@/lib/utils"

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  once?: boolean
}

const variants: Variants = {
  hidden: (y: number) => ({ opacity: 0, y }),
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
  once = true,
}: RevealProps) {
  return (
    <motion.div
      className={cn(className)}
      custom={y}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-80px" }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  )
}
