/**
 * Deciding what counts as a new DM. Instagram has no "new conversations"
 * metric, so it is derived: a new DM is the first inbound message from a
 * person who had never messaged this account before.
 *
 * Only metadata is handled here (who, which account, when). Message text is
 * never read, stored, or logged.
 */

export interface MessagingEvent {
  /** The connected professional account (entry.id). */
  igUserId: string
  senderId: string | null
  recipientId: string | null
  timestampMs: number | null
  /** The event carries a message (not a read receipt, reaction, or postback). */
  hasMessage: boolean
  isEcho: boolean
  isDeleted: boolean
}

export type IgnoreReason =
  | "echo"
  | "own_account"
  | "not_a_message"
  | "deleted"
  | "missing_sender"

export type InboundDecision =
  | { kind: "inbound"; igUserId: string; senderId: string; at: Date }
  | { kind: "ignore"; reason: IgnoreReason }

/**
 * Classifies one messaging webhook event. `ownIds` are every ID the
 * connected account is known by (professional account ID and app scoped ID).
 */
export function classifyMessagingEvent(
  event: MessagingEvent,
  ownIds: readonly string[],
  receivedAt: Date,
): InboundDecision {
  if (!event.hasMessage) return { kind: "ignore", reason: "not_a_message" }
  // Echoes are copies of messages the account itself sent, including the
  // automation's private replies.
  if (event.isEcho) return { kind: "ignore", reason: "echo" }
  if (event.isDeleted) return { kind: "ignore", reason: "deleted" }
  if (!event.senderId) return { kind: "ignore", reason: "missing_sender" }
  const own = new Set([event.igUserId, ...ownIds])
  if (own.has(event.senderId)) return { kind: "ignore", reason: "own_account" }

  const at =
    event.timestampMs !== null && Number.isFinite(event.timestampMs)
      ? new Date(event.timestampMs)
      : receivedAt
  return { kind: "inbound", igUserId: event.igUserId, senderId: event.senderId, at }
}

/**
 * Collapses a batch to the earliest inbound message per account and sender,
 * so one delivery with several messages from the same person records one
 * conversation start.
 */
export function earliestInboundPerSender(
  decisions: readonly InboundDecision[],
): Array<{ igUserId: string; senderId: string; at: Date }> {
  const earliest = new Map<string, { igUserId: string; senderId: string; at: Date }>()
  for (const d of decisions) {
    if (d.kind !== "inbound") continue
    const key = `${d.igUserId}:${d.senderId}`
    const current = earliest.get(key)
    if (!current || d.at < current.at) {
      earliest.set(key, { igUserId: d.igUserId, senderId: d.senderId, at: d.at })
    }
  }
  return [...earliest.values()]
}

/**
 * Which inbound messages start a new conversation, given the senders already
 * known for the account. Mirrors what record_inbound_dm does in the database,
 * where the unique constraint makes it race free.
 */
export function newConversations(
  inbound: ReadonlyArray<{ senderId: string; at: Date }>,
  knownSenders: ReadonlySet<string>,
): Array<{ senderId: string; at: Date }> {
  const seen = new Set(knownSenders)
  const out: Array<{ senderId: string; at: Date }> = []
  for (const m of [...inbound].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (seen.has(m.senderId)) continue
    seen.add(m.senderId)
    out.push(m)
  }
  return out
}

/**
 * A conversation is attributed to an automation when that person was sent an
 * automation DM at or before their first inbound message.
 */
export function isAutomationAttributed(
  firstInboundAt: Date,
  automationDmSentAt: ReadonlyArray<Date | null>,
): boolean {
  return automationDmSentAt.some((t) => t !== null && t.getTime() <= firstInboundAt.getTime())
}

// --------------------------------------------------------------- backfill

export interface BackfillThread {
  participants: Array<{ id: string; username: string | null }>
  /** Newest first, as the Conversations API returns them. */
  messages: Array<{ createdTime: string; fromId: string | null }>
  /** True when the thread has more messages than were returned. */
  hasMoreMessages: boolean
}

export type BackfillDecision =
  | { kind: "conversation"; threadKey: string; firstInboundAt: Date | null }
  | { kind: "skip"; reason: "no_other_participant" | "never_messaged" }

/**
 * Seeds a conversation from the Conversations API. Instagram only returns
 * details for the 20 newest messages, so the first inbound time is exact only
 * when the whole thread fits. Otherwise the sender is recorded with an unknown
 * time: they are known (so a later message is not miscounted as new) but
 * never counted as a new DM themselves.
 */
export function classifyBackfillThread(
  thread: BackfillThread,
  ownIds: readonly string[],
  ownUsername: string | null,
): BackfillDecision {
  const own = new Set(ownIds)
  const other = thread.participants.find(
    (p) => !own.has(p.id) && !(ownUsername && p.username === ownUsername),
  )
  if (!other) return { kind: "skip", reason: "no_other_participant" }

  const inbound = thread.messages.filter((m) => m.fromId !== null && !own.has(m.fromId))
  const unknownSender = thread.messages.some((m) => m.fromId === null)

  if (!thread.hasMoreMessages && !unknownSender) {
    if (inbound.length === 0) return { kind: "skip", reason: "never_messaged" }
    const first = inbound
      .map((m) => new Date(m.createdTime))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())[0]
    return { kind: "conversation", threadKey: other.id, firstInboundAt: first ?? null }
  }

  // Part of the thread is hidden. If they have messaged in what we can see,
  // or might have in what we can't, keep them as a known sender.
  return { kind: "conversation", threadKey: other.id, firstInboundAt: null }
}
