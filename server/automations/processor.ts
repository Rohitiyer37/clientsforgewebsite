import { composeDmText } from "../../shared/instagram"
import type { TriggerType } from "../../shared/keywords"
import { decryptSecret } from "../crypto"
import type { Db } from "../db"
import type { Row, Update } from "../database.types"
import { cryptoEnv } from "../env"
import type { InstagramClient } from "../instagram/client"
import { MetaApiError, describeMetaError } from "../instagram/errors"
import { markAccountExpired } from "../instagram/accounts"
import { log } from "../log"
import {
  isSelfComment,
  isWithinReplyWindow,
  pickReply,
  selectAutomation,
} from "./rules"

type EventRow = Row<"comment_events">

export interface ProcessorDeps {
  db: Db
  ig: InstagramClient
  now?: () => Date
  random?: () => number
}

export type ProcessOutcome =
  | "not_claimed"
  | "skipped"
  | "no_match"
  | "dm_sent"
  | "failed"

/**
 * Processes one comment event. Idempotent and safe to call repeatedly or
 * concurrently: the row is claimed atomically first, and each sub step's
 * result is written the moment the API call returns, so a public reply or DM
 * that Meta confirmed is never sent twice, even if this function crashes
 * part way through and the event is retried.
 */
export async function processCommentEvent(
  eventId: string,
  deps: ProcessorDeps,
): Promise<ProcessOutcome> {
  const { db: database, ig } = deps
  const now = deps.now ?? (() => new Date())

  const { data: claimed, error: claimError } = await database.rpc("claim_comment_event", {
    p_event_id: eventId,
  })
  if (claimError) throw new Error(`Claim failed: ${claimError.message}`)
  const event = claimed?.[0]
  if (!event) return "not_claimed"

  const ctx = { eventId, clientId: event.client_id, attempt: event.attempts }

  const patch = async (fields: Update<"comment_events">) => {
    const { error } = await database.from("comment_events").update(fields).eq("id", eventId)
    if (error) throw new Error(`Event update failed: ${error.message}`)
  }

  const finish = async (
    status: "skipped" | "no_match",
    reason: string | null,
    extra: Update<"comment_events"> = {},
  ): Promise<ProcessOutcome> => {
    await patch({
      status,
      error: reason,
      retryable: false,
      processed_at: now().toISOString(),
      ...extra,
    })
    log.info("event_finished", { ...ctx, status })
    return status
  }

  try {
    // 1. The connected account this comment belongs to.
    const { data: account, error: accountError } = await database
      .from("instagram_accounts")
      .select("*")
      .eq("ig_user_id", event.ig_user_id)
      .maybeSingle()
    if (accountError) throw new Error(`Account lookup failed: ${accountError.message}`)
    if (!account || account.status !== "active" || !account.access_token_encrypted) {
      return finish("skipped", "Instagram is not connected for this account, so nothing was sent.")
    }
    const clientFields = event.client_id ? {} : { client_id: account.client_id }

    // 2. Never answer the account's own comments (our public replies echo back).
    if (
      isSelfComment(
        { commenterId: event.commenter_id, commenterUsername: event.commenter_username },
        { igUserId: account.ig_user_id, igScopedId: account.ig_scoped_id, username: account.username },
      )
    ) {
      return finish("skipped", null, clientFields)
    }

    // 3. The active automation on this post whose trigger matches.
    const { data: automations, error: autoError } = await database
      .from("automations")
      .select("*")
      .eq("instagram_account_id", account.id)
      .eq("is_active", true)
      .eq("media_id", event.media_id ?? "")
    if (autoError) throw new Error(`Automation lookup failed: ${autoError.message}`)

    const automation = selectAutomation(
      (automations ?? []).map((a) => ({
        ...a,
        isActive: a.is_active,
        mediaId: a.media_id,
        triggerType: a.trigger_type as TriggerType,
      })),
      event.media_id,
      event.comment_text ?? "",
    )
    if (!automation) return finish("no_match", null, clientFields)

    await patch({ automation_id: automation.id, ...clientFields })

    // 4. Private Replies are only allowed within 7 days of the comment.
    if (!isWithinReplyWindow(new Date(event.received_at), now())) {
      return finish(
        "skipped",
        "This comment is more than 7 days old. Instagram only allows a private reply within 7 days.",
      )
    }

    const token = decryptSecret(account.access_token_encrypted, cryptoEnv().TOKEN_ENCRYPTION_KEY)
    const errors: string[] = []
    let retryableFailure = false
    let tokenFailure = false

    const noteFailure = async (step: string, err: unknown) => {
      if (err instanceof MetaApiError && err.kind === "token") {
        tokenFailure = true
        await markAccountExpired(database, account.id, err.message)
      }
      if (err instanceof MetaApiError ? err.retryable : true) retryableFailure = true
      errors.push(`${step}: ${describeMetaError(err)}`)
      log.warn("event_step_failed", {
        ...ctx,
        automationId: automation.id,
        step,
        kind: err instanceof MetaApiError ? err.kind : "unknown",
        code: err instanceof MetaApiError ? err.details.code : undefined,
      })
    }

    // 5. Optional public reply. Skipped if a previous attempt already sent it.
    let publicStatus = event.public_reply_status
    if (!automation.public_reply_enabled) {
      if (!publicStatus) {
        publicStatus = "skipped"
        await patch({ public_reply_status: "skipped" })
      }
    } else if (publicStatus !== "sent") {
      const reply = pickReply(automation.public_replies, deps.random)
      if (!reply) {
        publicStatus = "skipped"
        await patch({ public_reply_status: "skipped" })
      } else {
        try {
          await ig.replyToComment(token, event.comment_id, reply)
          publicStatus = "sent"
          await patch({ public_reply_status: "sent", status: "replied" })
        } catch (err) {
          publicStatus = "failed"
          await patch({ public_reply_status: "failed" })
          await noteFailure("Public reply", err)
        }
      }
    }

    // 6. The DM, as a Private Reply to the comment. Only one is ever allowed
    // per comment, so a DM Meta confirmed is never attempted again. A token
    // failure above means this would fail too, so it is not attempted.
    let dmStatus = event.dm_status
    if (dmStatus !== "sent" && !tokenFailure) {
      try {
        const text = composeDmText(
          automation.dm_message,
          automation.dm_link_url,
          automation.dm_link_label,
        )
        await ig.sendPrivateReply(token, event.comment_id, text)
        dmStatus = "sent"
        // The time is what attributes a later inbound DM to this automation.
        await patch({ dm_status: "sent", dm_sent_at: now().toISOString() })
      } catch (err) {
        dmStatus = "failed"
        await patch({ dm_status: "failed" })
        await noteFailure("DM", err)
      }
    }

    // 7. Final state. The event only succeeds when the DM went out and
    // nothing that could still succeed on retry is outstanding.
    const done = dmStatus === "sent" && (publicStatus !== "failed" || !retryableFailure)
    const status = done ? "dm_sent" : "failed"
    await patch({
      status,
      error: errors.length ? errors.join(" ") : null,
      retryable: !done && retryableFailure && !tokenFailure,
      processed_at: now().toISOString(),
    })
    log.info("event_finished", { ...ctx, automationId: automation.id, status })
    return status
  } catch (err) {
    // Infrastructure failure (database, config). Leave it retryable.
    log.error("event_processing_error", { ...ctx, error: err })
    await database
      .from("comment_events")
      .update({
        status: "failed",
        retryable: true,
        error: "Something unexpected went wrong. We will try again automatically.",
      })
      .eq("id", eventId)
    return "failed"
  }
}

/** Processes events one after another within a time budget. */
export async function processEvents(
  ids: readonly string[],
  deps: ProcessorDeps,
  deadlineMs = 50_000,
): Promise<Record<ProcessOutcome, number>> {
  const started = Date.now()
  const counts: Record<ProcessOutcome, number> = {
    not_claimed: 0,
    skipped: 0,
    no_match: 0,
    dm_sent: 0,
    failed: 0,
  }
  for (const id of ids) {
    if (Date.now() - started > deadlineMs) break
    counts[await processCommentEvent(id, deps)]++
  }
  return counts
}

export type { EventRow }
