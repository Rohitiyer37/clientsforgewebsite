import { useCallback, useEffect, useState } from "react"
import { Check, Clapperboard, ImageOff, Loader2 } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { isReel, type MediaItem } from "../../../shared/instagram"
import { ApiError, api } from "../api"

interface MediaPage {
  items: MediaItem[]
  nextCursor: string | null
}

function Thumb({ item }: { item: MediaItem }) {
  const [broken, setBroken] = useState(false)
  if (!item.thumbnailUrl || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/[0.04] text-fg-muted/50">
        <ImageOff className="h-5 w-5" />
      </div>
    )
  }
  return (
    <img
      src={item.thumbnailUrl}
      alt={item.caption ? item.caption.slice(0, 80) : "Instagram post"}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover"
    />
  )
}

export function MediaPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (item: MediaItem) => void
}) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPage = useCallback(async (after: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const qs = after ? `?after=${encodeURIComponent(after)}` : ""
      const page = await api<MediaPage>(`/api/instagram/media${qs}`)
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id))
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))]
      })
      setCursor(page.nextCursor)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your posts.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPage(null)
  }, [loadPage])

  if (error && items.length === 0) {
    return (
      <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5 text-center">
        <p className="text-[14px] text-fg">{error}</p>
        <button
          type="button"
          onClick={() => void loadPage(null)}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
        >
          Try again
        </button>
      </div>
    )
  }

  if (!loading && items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-[14px] text-fg-muted">
        This account has no posts yet. Publish a reel, then come back.
      </p>
    )
  }

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Choose a reel or post"
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {items.map((item) => {
          const selected = item.id === selectedId
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(item)}
              className={cn(
                "group relative aspect-[9/16] overflow-hidden rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
                selected ? "border-gold" : "border-transparent hover:border-white/20",
              )}
            >
              <Thumb item={item} />
              {isReel(item) && (
                <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  <Clapperboard className="h-3 w-3" />
                  Reel
                </span>
              )}
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center bg-gold/25">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-ink">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex justify-center">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gold-light" aria-label="Loading posts" />
        ) : cursor ? (
          <button
            type="button"
            onClick={() => void loadPage(cursor)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Load more
          </button>
        ) : null}
      </div>
      {error && items.length > 0 && (
        <p className="mt-2 text-center text-[13px] text-red-300">{error}</p>
      )}
    </div>
  )
}
