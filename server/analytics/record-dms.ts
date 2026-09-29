import type { Db } from "../db"
import { log } from "../log"
import { classifyMessagingEvent, earliestInboundPerSender, type MessagingEvent } from "./dm"

/**
 * Records conversation starts from a messages webhook delivery. Runs after
 * the webhook has answered Meta. Stores who and when, never what was said.
 */
export async function recordInboundMessages(
  database: Db,
  events: readonly MessagingEvent[],
  receivedAt: Date,
): Promise<{ inbound: number; newConversations: number; ignored: number }> {
  const igIds = [...new Set(events.map((e) => e.igUserId))]
  const { data: accounts, error } = await database
    .from("instagram_accounts")
    .select("id, ig_user_id, ig_scoped_id")
    .in("ig_user_id", igIds)
  if (error) throw new Error(`Account lookup failed: ${error.message}`)
  const byIg = new Map((accounts ?? []).map((a) => [a.ig_user_id, a]))

  const decisions = events.map((e) => {
    const account = byIg.get(e.igUserId)
    return classifyMessagingEvent(e, account?.ig_scoped_id ? [account.ig_scoped_id] : [], receivedAt)
  })
  const inbound = earliestInboundPerSender(decisions)

  let created = 0
  for (const message of inbound) {
    const account = byIg.get(message.igUserId)
    if (!account) continue
    const { data, error: rpcError } = await database.rpc("record_inbound_dm", {
      p_account_id: account.id,
      p_thread_key: message.senderId,
      p_at: message.at.toISOString(),
    })
    if (rpcError) throw new Error(`Recording DM failed: ${rpcError.message}`)
    if (data === true) created++
  }

  return {
    inbound: inbound.length,
    newConversations: created,
    ignored: decisions.filter((d) => d.kind === "ignore").length,
  }
}

export function logRecordFailure(err: unknown): void {
  log.error("webhook_messages_failed", { error: err })
}
