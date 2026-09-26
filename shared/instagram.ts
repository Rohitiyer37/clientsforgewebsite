/** Instagram types and helpers shared by the dashboard UI and the server. */

export interface MediaItem {
  id: string
  caption: string | null
  mediaType: string
  /** "REELS", "FEED", "STORY", or "AD". */
  productType: string | null
  thumbnailUrl: string | null
  permalink: string | null
  timestamp: string | null
}

export function isReel(item: Pick<MediaItem, "productType">): boolean {
  return item.productType === "REELS"
}

/** Instagram rejects message text over 1000 characters. */
export const DM_MAX_LENGTH = 1000

/**
 * Builds the exact text sent as the private reply. Private replies are plain
 * text (templates are only documented for normal DMs), so a labelled link is
 * written inline as "Label: https://...". The UI preview uses this too, so
 * what clients see is exactly what commenters receive.
 */
export function composeDmText(
  message: string,
  linkUrl?: string | null,
  linkLabel?: string | null,
): string {
  const body = message.trim()
  const url = linkUrl?.trim()
  if (!url) return body
  const label = linkLabel?.trim()
  return `${body}\n\n${label ? `${label}: ${url}` : url}`
}
