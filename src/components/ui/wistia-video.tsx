import { useEffect } from "react"

const MEDIA_ID = "09hrzvtooo"

function loadScript(src: string, asModule = false) {
  if (document.querySelector(`script[src="${src}"]`)) return
  const s = document.createElement("script")
  s.src = src
  s.async = true
  if (asModule) s.type = "module"
  document.head.appendChild(s)
}

export function WistiaVideo() {
  useEffect(() => {
    loadScript("https://fast.wistia.com/player.js")
    loadScript(`https://fast.wistia.com/embed/${MEDIA_ID}.js`, true)
  }, [])

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle,rgba(232,192,120,0.18),transparent_70%)] blur-2xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-card shadow-card">
        <wistia-player
          media-id={MEDIA_ID}
          aspect="1.7777777777777777"
        ></wistia-player>
      </div>
    </div>
  )
}
