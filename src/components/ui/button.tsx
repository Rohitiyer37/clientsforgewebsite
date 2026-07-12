import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-white text-ink hover:bg-white/90 hover:-translate-y-0.5 shadow-[0_10px_30px_-10px_rgba(255,255,255,0.35)]",
        gold: "bg-gold-gradient-135 text-ink font-semibold hover:-translate-y-0.5 shadow-[0_12px_40px_-12px_rgba(201,162,75,0.6)]",
        outline:
          "border border-white/15 bg-ink-raised/60 text-fg hover:border-white/30 hover:bg-ink-raised",
        ghost: "text-fg-muted hover:text-fg",
      },
      size: {
        sm: "h-9 px-4",
        default: "h-11 px-6",
        lg: "h-14 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
