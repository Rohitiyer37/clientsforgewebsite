import { matchesTrigger, type TriggerType } from "../../shared/keywords"

/**
 * Pure decision rules for the processor, kept free of I/O so they can be
 * unit tested exactly as they run in production.
 */

/** Meta allows a Private Reply only within 7 days of the comment. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function isWithinReplyWindow(commentedAt: Date, now: Date): boolean {
  const age = now.getTime() - commentedAt.getTime()
  // A slightly future timestamp (clock skew) is still inside the window.
  return age < PRIVATE_REPLY_WINDOW_MS
}

/**
 * True when the comment was written by the connected account itself, for
 * example our own public reply echoing back as a new comment event. Replying
 * to those would loop forever. Matches on the professional account ID, the
 * app scoped ID, or the username, whichever the webhook carried.
 */
export function isSelfComment(
  comment: { commenterId: string | null; commenterUsername: string | null },
  account: { igUserId: string; igScopedId: string | null; username: string },
): boolean {
  if (comment.commenterId) {
    if (comment.commenterId === account.igUserId) return true
    if (account.igScopedId && comment.commenterId === account.igScopedId) return true
  }
  if (comment.commenterUsername) {
    return comment.commenterUsername.toLowerCase() === account.username.toLowerCase()
  }
  return false
}

export interface TriggerCandidate {
  id: string
  isActive: boolean
  mediaId: string
  triggerType: TriggerType
  keywords: string[]
}

/**
 * The active automation on this post whose trigger matches the comment. The
 * save rule forbids two active automations with overlapping triggers on one
 * post, but if that were ever violated, a keyword automation wins over "any
 * comment" as the more specific intent, then the oldest id for determinism.
 */
export function selectAutomation<T extends TriggerCandidate>(
  candidates: readonly T[],
  mediaId: string | null,
  commentText: string,
): T | null {
  if (!mediaId) return null
  const matches = candidates.filter(
    (a) => a.isActive && a.mediaId === mediaId && matchesTrigger(commentText, a),
  )
  matches.sort((a, b) => {
    if (a.triggerType !== b.triggerType) return a.triggerType === "keywords" ? -1 : 1
    return a.id.localeCompare(b.id)
  })
  return matches[0] ?? null
}

/** Picks one public reply variant at random so replies do not look robotic. */
export function pickReply(replies: readonly string[], random: () => number = Math.random): string | null {
  const usable = replies.filter((r) => r.trim().length > 0)
  if (usable.length === 0) return null
  const index = Math.min(usable.length - 1, Math.floor(random() * usable.length))
  return usable[index] ?? null
}
