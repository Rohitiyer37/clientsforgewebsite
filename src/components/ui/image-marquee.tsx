import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

interface MarqueeImage {
  src: string
  alt?: string
}

interface ImageMarqueeProps {
  images: MarqueeImage[]
  className?: string
  /** "left" drifts content leftward, "right" drifts it left-to-right. */
  direction?: "left" | "right"
}

function Card({ src, alt }: MarqueeImage) {
  return (
    <div className="relative h-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-ink-card shadow-card sm:h-56 lg:h-64">
      <img
        src={src}
        alt={alt || ""}
        draggable={false}
        className="h-full w-auto select-none"
      />
    </div>
  )
}

export function ImageMarquee({
  images,
  className,
  direction = "right",
}: ImageMarqueeProps) {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  // Reduced motion: a plain, manually scrollable row (no auto-animation).
  if (reduce) {
    return (
      <div
        className={cn(
          "flex gap-5 overflow-x-auto px-6 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        {images.map((img, i) => (
          <Card key={i} {...img} />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("group relative overflow-hidden", className)}>
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink to-transparent sm:w-28" />

      <div
        className={cn(
          "flex w-max gap-5 group-hover:[animation-play-state:paused]",
          direction === "right" ? "animate-marquee-reverse" : "animate-marquee",
        )}
      >
        {/* duplicated set for a seamless loop */}
        {[...images, ...images].map((img, i) => (
          <Card key={i} {...img} />
        ))}
      </div>
    </div>
  )
}
