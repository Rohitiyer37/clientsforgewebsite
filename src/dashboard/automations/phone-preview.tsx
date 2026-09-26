import { useState } from "react"
import { ImageOff, Instagram } from "lucide-react"

import { composeDmText, type MediaItem } from "../../../shared/instagram"

/**
 * What the commenter will see: their comment with the public reply under
 * it, then the DM. The DM text comes from composeDmText, the same function
 * the server sends with, so this is exactly what arrives.
 */
export function PhonePreview({
  username,
  avatarUrl,
  media,
  sampleComment,
  publicReply,
  dmMessage,
  dmLinkUrl,
  dmLinkLabel,
}: {
  username: string
  avatarUrl: string | null
  media: MediaItem | null
  sampleComment: string
  publicReply: string | null
  dmMessage: string
  dmLinkUrl: string
  dmLinkLabel: string
}) {
  const [broken, setBroken] = useState(false)
  const dm = composeDmText(dmMessage || "Your DM will appear here.", dmLinkUrl, dmLinkLabel)

  const Avatar = ({ size }: { size: string }) =>
    avatarUrl ? (
      <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full object-cover`} />
    ) : (
      <span className={`${size} flex items-center justify-center rounded-full bg-white/10 text-fg-muted`}>
        <Instagram className="h-3 w-3" />
      </span>
    )

  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[40px] border border-white/10 bg-black p-3 shadow-card">
      <div className="overflow-hidden rounded-[30px] bg-[#0b0b0b]">
        {/* Comment thread */}
        <div className="flex gap-3 border-b border-white/[0.06] p-4">
          <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
            {media?.thumbnailUrl && !broken ? (
              <img
                src={media.thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setBroken(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-fg-muted/40">
                <ImageOff className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2.5 text-[12px]">
            <p className="text-white/90">
              <span className="font-semibold">a.follower </span>
              {sampleComment}
            </p>
            {publicReply && (
              <div className="flex gap-2 pl-3">
                <Avatar size="h-5 w-5 shrink-0" />
                <p className="text-white/80">
                  <span className="font-semibold">{username} </span>
                  {publicReply}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* DM */}
        <div className="p-4">
          <div className="flex items-center gap-2">
            <Avatar size="h-7 w-7" />
            <p className="text-[12px] font-semibold text-white">{username}</p>
          </div>
          <div className="mt-3 flex">
            <p className="max-w-[92%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-[#262626] px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
              {dm}
            </p>
          </div>
          <p className="mt-2 text-[10px] text-white/35">
            Sent as a private reply to their comment.
          </p>
        </div>
      </div>
    </div>
  )
}
