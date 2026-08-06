import { useEffect, useRef, useState } from "react"

const SIZE = 560
// Lower = more lag (more "delay" trailing the cursor). 0.10 to 0.14 feels premium.
const EASE = 0.12
const FADE = 0.09

/**
 * A soft, warm-gold glow that trails the cursor with a slight delay.
 * Scoped to its parent element: it only appears while the cursor is over
 * that section and fades out on leave. The delay comes from a per-frame
 * lerp toward the cursor position. Screen blend means it only ever adds
 * light, it never intercepts pointer events, and it is disabled under
 * prefers-reduced-motion.
 */
export function CursorGlow() {
  const [reduce, setReduce] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduce(mq.matches)
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    if (reduce) return
    const el = ref.current
    const region = el?.parentElement
    if (!el || !region) return

    const target = { x: 0, y: 0 }
    const pos = { x: 0, y: 0 }
    let visible = 0 // 0..1 target opacity
    let opacity = 0
    let started = false
    let raf = 0

    const onMove = (e: MouseEvent) => {
      const r = region.getBoundingClientRect()
      target.x = e.clientX - r.left - SIZE / 2
      target.y = e.clientY - r.top - SIZE / 2
      visible = 1
      if (!started) {
        pos.x = target.x
        pos.y = target.y
        started = true
      }
    }
    const onEnter = () => {
      visible = 1
    }
    const onLeave = () => {
      visible = 0
    }

    const tick = () => {
      pos.x += (target.x - pos.x) * EASE
      pos.y += (target.y - pos.y) * EASE
      opacity += (visible - opacity) * FADE
      el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
      el.style.opacity = opacity.toFixed(3)
      raf = requestAnimationFrame(tick)
    }

    region.addEventListener("mousemove", onMove, { passive: true })
    region.addEventListener("mouseenter", onEnter)
    region.addEventListener("mouseleave", onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      region.removeEventListener("mousemove", onMove)
      region.removeEventListener("mouseenter", onEnter)
      region.removeEventListener("mouseleave", onLeave)
      cancelAnimationFrame(raf)
    }
  }, [reduce])

  if (reduce) return null

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-[15] hidden mix-blend-screen md:block"
      style={{
        width: SIZE,
        height: SIZE,
        opacity: 0,
        willChange: "transform, opacity",
        background:
          "radial-gradient(circle, rgba(232,192,120,0.18) 0%, rgba(201,162,75,0.09) 32%, rgba(201,162,75,0) 62%)",
      }}
    />
  )
}
