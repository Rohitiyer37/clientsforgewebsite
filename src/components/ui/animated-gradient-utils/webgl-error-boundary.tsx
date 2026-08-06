import React from "react"

import { cn } from "@/lib/utils"

interface WebGLErrorBoundaryProps {
  children: React.ReactNode
  fallback: React.ReactNode
}

interface WebGLErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches render errors coming from the WebGL canvas so a driver or context
 * failure degrades to a static gradient instead of blanking the page.
 */
export class WebGLErrorBoundary extends React.Component<
  WebGLErrorBoundaryProps,
  WebGLErrorBoundaryState
> {
  constructor(props: WebGLErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): WebGLErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

/**
 * Static coral to black gradient. Used wherever WebGL2 is unavailable so the
 * hero still reads as intentional rather than broken.
 */
export function WebGLFallback({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden bg-[#0a0503]", className)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_115%,rgba(242,84,45,0.55),rgba(242,84,45,0.14)_38%,transparent_68%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_10%,rgba(184,58,24,0.22),transparent_45%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#f2542d]/20 via-transparent to-transparent" />
    </div>
  )
}
