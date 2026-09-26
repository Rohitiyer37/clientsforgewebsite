import type {
  AutomationDto,
  AutomationInput,
  CommentEventDto,
  EventStatus,
} from "../../shared/automation"
import type { TriggerType } from "../../shared/keywords"
import type { Db } from "../db"
import type { Json, Row } from "../database.types"
import { HttpError } from "../http"
import {
  handleGraphError,
  instagramClient,
  requireActiveAccount,
} from "../instagram/accounts"

type AutomationRow = Row<"automations">
type Stats = AutomationDto["stats"]
const NO_STATS: Stats = { matched: 0, dmsSent: 0, failures: 0 }

export function toDto(row: AutomationRow, stats: Stats = NO_STATS): AutomationDto {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    mediaId: row.media_id,
    mediaType: row.media_type,
    mediaThumbnailUrl: row.media_thumbnail_url,
    mediaPermalink: row.media_permalink,
    mediaCaption: row.media_caption,
    triggerType: row.trigger_type as TriggerType,
    keywords: row.keywords,
    publicReplyEnabled: row.public_reply_enabled,
    publicReplies: row.public_replies,
    dmMessage: row.dm_message,
    dmLinkUrl: row.dm_link_url,
    dmLinkLabel: row.dm_link_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stats,
  }
}

async function loadStats(database: Db, clientId: string): Promise<Map<string, Stats>> {
  const { data, error } = await database.rpc("automation_stats", { p_client_id: clientId })
  if (error) throw new Error(`Stats query failed: ${error.message}`)
  return new Map(
    (data ?? []).map((s) => [
      s.automation_id,
      { matched: Number(s.matched), dmsSent: Number(s.dms_sent), failures: Number(s.failures) },
    ]),
  )
}

export async function listAutomations(database: Db, clientId: string): Promise<AutomationDto[]> {
  const [{ data, error }, stats] = await Promise.all([
    database
      .from("automations")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    loadStats(database, clientId),
  ])
  if (error) throw new Error(`Automation list failed: ${error.message}`)
  return (data ?? []).map((row) => toDto(row, stats.get(row.id)))
}

/** Scoped by client: another client's automation is indistinguishable from none. */
export async function getAutomationRow(
  database: Db,
  clientId: string,
  id: string,
): Promise<AutomationRow> {
  const { data, error } = await database
    .from("automations")
    .select("*")
    .eq("id", id)
    .eq("client_id", clientId)
    .maybeSingle()
  if (error) throw new Error(`Automation lookup failed: ${error.message}`)
  if (!data) throw new HttpError(404, "Automation not found")
  return data
}

export async function getAutomation(
  database: Db,
  clientId: string,
  id: string,
): Promise<AutomationDto> {
  const [row, stats] = await Promise.all([
    getAutomationRow(database, clientId, id),
    loadStats(database, clientId),
  ])
  return toDto(row, stats.get(id))
}

function rowToInput(row: AutomationRow): AutomationInput {
  return {
    name: row.name,
    mediaId: row.media_id,
    triggerType: row.trigger_type as TriggerType,
    keywords: row.keywords,
    publicReplyEnabled: row.public_reply_enabled,
    publicReplies: row.public_replies,
    dmMessage: row.dm_message,
    dmLinkUrl: row.dm_link_url,
    dmLinkLabel: row.dm_link_label,
    isActive: row.is_active,
  }
}

/**
 * Creates (id null) or updates an automation. The media is re-fetched with
 * the client's own token, which both proves the post belongs to their
 * account and gives us fresh thumbnail details rather than trusting the
 * browser. The overlap rule is enforced atomically inside save_automation.
 */
export async function saveAutomation(
  database: Db,
  clientId: string,
  id: string | null,
  input: AutomationInput,
): Promise<AutomationDto> {
  const { account, token } = await requireActiveAccount(database, clientId)

  let media
  try {
    media = await instagramClient().getMedia(token, input.mediaId)
  } catch (err) {
    return handleGraphError(database, account, err)
  }

  const payload: Json = {
    instagram_account_id: account.id,
    name: input.name,
    is_active: input.isActive,
    media_id: media.id,
    media_type: media.productType ?? media.mediaType,
    media_thumbnail_url: media.thumbnailUrl,
    media_permalink: media.permalink,
    media_caption: media.caption ? media.caption.slice(0, 500) : null,
    trigger_type: input.triggerType,
    keywords: input.triggerType === "keywords" ? input.keywords : [],
    public_reply_enabled: input.publicReplyEnabled,
    public_replies: input.publicReplyEnabled ? input.publicReplies : [],
    dm_message: input.dmMessage,
    dm_link_url: input.dmLinkUrl ?? "",
    dm_link_label: input.dmLinkUrl ? input.dmLinkLabel ?? "" : "",
  }

  const { data, error } = await database.rpc("save_automation", {
    p_client_id: clientId,
    p_automation_id: id,
    p_payload: payload,
  })

  if (error) {
    if (error.message.includes("TRIGGER_OVERLAP")) {
      throw new HttpError(
        409,
        "Another active automation on this post already responds to these comments. Pause it, or use different keywords.",
        "TRIGGER_OVERLAP",
      )
    }
    if (error.message.includes("NOT_FOUND")) throw new HttpError(404, "Automation not found")
    throw new Error(`Saving automation failed: ${error.message}`)
  }

  const row = data?.[0]
  if (!row) throw new Error("Saving automation returned no row")
  const stats = await loadStats(database, clientId)
  return toDto(row, stats.get(row.id))
}

export async function setAutomationActive(
  database: Db,
  clientId: string,
  id: string,
  isActive: boolean,
): Promise<AutomationDto> {
  const row = await getAutomationRow(database, clientId, id)
  if (!isActive) {
    const { data, error } = await database
      .from("automations")
      .update({ is_active: false })
      .eq("id", id)
      .eq("client_id", clientId)
      .select("*")
      .single()
    if (error) throw new Error(`Pausing automation failed: ${error.message}`)
    const stats = await loadStats(database, clientId)
    return toDto(data, stats.get(id))
  }
  // Activating goes through the full save so the overlap rule applies.
  return saveAutomation(database, clientId, id, { ...rowToInput(row), isActive: true })
}

export async function deleteAutomation(database: Db, clientId: string, id: string) {
  await getAutomationRow(database, clientId, id)
  const { error } = await database
    .from("automations")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId)
  if (error) throw new Error(`Deleting automation failed: ${error.message}`)
}

export async function listEvents(
  database: Db,
  clientId: string,
  automationId: string,
): Promise<CommentEventDto[]> {
  await getAutomationRow(database, clientId, automationId)
  const { data, error } = await database
    .from("comment_events")
    .select(
      "id, commenter_username, comment_text, status, public_reply_status, dm_status, error, received_at",
    )
    .eq("client_id", clientId)
    .eq("automation_id", automationId)
    .order("received_at", { ascending: false })
    .limit(100)
  if (error) throw new Error(`Activity query failed: ${error.message}`)
  return (data ?? []).map((e) => ({
    id: e.id,
    commenterUsername: e.commenter_username,
    commentText: e.comment_text,
    status: e.status as EventStatus,
    publicReplyStatus: e.public_reply_status as CommentEventDto["publicReplyStatus"],
    dmStatus: e.dm_status as CommentEventDto["dmStatus"],
    error: e.error,
    receivedAt: e.received_at,
  }))
}
