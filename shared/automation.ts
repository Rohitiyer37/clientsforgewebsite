import { z } from "zod"

import { DM_MAX_LENGTH, composeDmText } from "./instagram"
import { normalizeKeyword, type TriggerType } from "./keywords"

export const MAX_KEYWORDS = 20
export const MAX_KEYWORD_LENGTH = 50
export const MAX_REPLY_VARIANTS = 5
export const MAX_REPLY_LENGTH = 300
export const MAX_LINK_LABEL_LENGTH = 40

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname)
  } catch {
    return false
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

/**
 * One schema for both the builder form and the API. The server re-validates
 * everything the browser sends; client validation is for fast feedback only.
 */
export const AutomationInputSchema = z
  .object({
    name: z.string().trim().min(1, "Give this automation a name").max(80),
    mediaId: z.string().trim().regex(/^\d{1,40}$/, "Pick a reel or post"),
    triggerType: z.enum(["any_comment", "keywords"]),
    keywords: z
      .array(z.string().max(MAX_KEYWORD_LENGTH * 2))
      .max(MAX_KEYWORDS, `Use at most ${MAX_KEYWORDS} keywords`)
      .default([])
      .transform((list) => [...new Set(list.map(normalizeKeyword).filter(Boolean))]),
    publicReplyEnabled: z.boolean(),
    publicReplies: z
      .array(z.string())
      .max(MAX_REPLY_VARIANTS, `Use at most ${MAX_REPLY_VARIANTS} reply variants`)
      .default([])
      .transform((list) => list.map((r) => r.trim()).filter(Boolean)),
    dmMessage: z
      .string()
      .trim()
      .min(1, "Write the DM your commenters will receive")
      .max(DM_MAX_LENGTH),
    dmLinkUrl: optionalText(2000),
    dmLinkLabel: optionalText(MAX_LINK_LABEL_LENGTH),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.triggerType === "keywords" && v.keywords.length === 0) {
      ctx.addIssue({ code: "custom", path: ["keywords"], message: "Add at least one keyword" })
    }
    for (const k of v.keywords) {
      if (k.length > MAX_KEYWORD_LENGTH) {
        ctx.addIssue({
          code: "custom",
          path: ["keywords"],
          message: `Keywords can be at most ${MAX_KEYWORD_LENGTH} characters`,
        })
        break
      }
    }
    if (v.publicReplyEnabled && v.publicReplies.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["publicReplies"],
        message: "Add at least one public reply, or turn public replies off",
      })
    }
    if (v.publicReplies.some((r) => r.length > MAX_REPLY_LENGTH)) {
      ctx.addIssue({
        code: "custom",
        path: ["publicReplies"],
        message: `Replies can be at most ${MAX_REPLY_LENGTH} characters`,
      })
    }
    if (v.dmLinkUrl && !isHttpUrl(v.dmLinkUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["dmLinkUrl"],
        message: "Enter a full link starting with https://",
      })
    }
    if (v.dmLinkLabel && !v.dmLinkUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["dmLinkUrl"],
        message: "Add the link this label points to",
      })
    }
    if (composeDmText(v.dmMessage, v.dmLinkUrl, v.dmLinkLabel).length > DM_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        path: ["dmMessage"],
        message: `The DM including the link must be at most ${DM_MAX_LENGTH} characters`,
      })
    }
  })

export type AutomationInput = z.infer<typeof AutomationInputSchema>
export type AutomationFormValues = z.input<typeof AutomationInputSchema>

export const ToggleSchema = z.object({ isActive: z.boolean() })

/** API shape of an automation, as the dashboard receives it. */
export interface AutomationDto {
  id: string
  name: string
  isActive: boolean
  mediaId: string
  mediaType: string | null
  mediaThumbnailUrl: string | null
  mediaPermalink: string | null
  mediaCaption: string | null
  triggerType: TriggerType
  keywords: string[]
  publicReplyEnabled: boolean
  publicReplies: string[]
  dmMessage: string
  dmLinkUrl: string | null
  dmLinkLabel: string | null
  createdAt: string
  updatedAt: string
  stats: { matched: number; dmsSent: number; failures: number }
}

export type EventStatus =
  | "received"
  | "no_match"
  | "processing"
  | "replied"
  | "dm_sent"
  | "failed"
  | "skipped"

export interface CommentEventDto {
  id: string
  commenterUsername: string | null
  commentText: string | null
  status: EventStatus
  publicReplyStatus: "sent" | "failed" | "skipped" | null
  dmStatus: "sent" | "failed" | "skipped" | null
  error: string | null
  receivedAt: string
}

export function triggerSummary(a: Pick<AutomationDto, "triggerType" | "keywords">): string {
  if (a.triggerType === "any_comment") return "Any comment"
  const shown = a.keywords.slice(0, 3).map((k) => `"${k}"`).join(", ")
  const more = a.keywords.length > 3 ? ` +${a.keywords.length - 3}` : ""
  return `Comments with ${shown}${more}`
}
