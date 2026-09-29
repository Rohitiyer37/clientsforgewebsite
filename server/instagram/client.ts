import type { MediaItem } from "../../shared/instagram"
import type { BackfillThread } from "../analytics/dm"
import { MetaApiError, parseMetaError } from "./errors"
import {
  parseAccountInsights,
  parseConversations,
  parseMediaInsights,
  parseUsageHeaders,
  type AccountMetricValue,
  type ApiUsage,
} from "./insights"

/**
 * Typed client for the Instagram API with Instagram Login. Every Graph call in
 * the codebase goes through here, which gives one place for timeouts, error
 * parsing, and token handling.
 *
 * Tokens are sent in the Authorization header, never in the URL, so they can
 * never end up in a logged URL. The two OAuth token endpoints are the only
 * exception, because Meta requires the secret and token as parameters there.
 */

const OAUTH_HOST = "https://api.instagram.com"
const GRAPH_HOST = "https://graph.instagram.com"
const DEFAULT_TIMEOUT_MS = 10_000

/** What Automations cannot work without. A connection missing one fails. */
export const REQUIRED_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const

/** Needed only by Content Analytics. Missing it shows a reconnect banner there. */
export const INSIGHTS_SCOPE = "instagram_business_manage_insights"

export const INSTAGRAM_SCOPES = [...REQUIRED_SCOPES, INSIGHTS_SCOPE] as const

/** Webhook fields every connected account is subscribed to. */
export const WEBHOOK_FIELDS = ["comments", "messages"] as const

export interface InstagramProfile {
  /** Professional account ID. Matches entry.id in webhooks. */
  userId: string
  /** App scoped ID. */
  scopedId: string | null
  username: string
  profilePictureUrl: string | null
  accountType: string | null
}

export interface TokenResult {
  accessToken: string
  expiresInSeconds: number
}

const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp"

interface RawMedia {
  id: string
  caption?: string
  media_type?: string
  media_product_type?: string
  thumbnail_url?: string
  media_url?: string
  permalink?: string
  timestamp?: string
}

function toMediaItem(raw: RawMedia): MediaItem {
  // Videos and reels expose a thumbnail_url; images only have media_url.
  const thumb =
    raw.thumbnail_url ?? (raw.media_type === "VIDEO" ? null : raw.media_url ?? null)
  return {
    id: raw.id,
    caption: raw.caption ?? null,
    mediaType: raw.media_type ?? "UNKNOWN",
    productType: raw.media_product_type ?? null,
    thumbnailUrl: thumb,
    permalink: raw.permalink ?? null,
    timestamp: raw.timestamp ?? null,
  }
}

export class InstagramClient {
  private readonly graph: string

  constructor(
    private readonly options: {
      version: string
      timeoutMs?: number
      fetchImpl?: typeof fetch
      /** Called after every response Meta sends, with its quota usage. */
      onResponse?: (usage: ApiUsage) => void
    },
  ) {
    this.graph = `${GRAPH_HOST}/${options.version}`
  }

  private async request<T>(
    url: string,
    init: RequestInit & { token?: string } = {},
  ): Promise<T> {
    const { token, headers, ...rest } = init
    const h = new Headers(headers)
    if (token) h.set("Authorization", `Bearer ${token}`)

    let res: Response
    try {
      res = await (this.options.fetchImpl ?? fetch)(url, {
        ...rest,
        headers: h,
        signal: AbortSignal.timeout(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      })
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError"
      throw new MetaApiError(
        "transient",
        timedOut ? "Instagram did not respond in time" : "Could not reach Instagram",
      )
    }

    this.options.onResponse?.(parseUsageHeaders(res.headers))

    const text = await res.text()
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = null
      }
    }

    const hasError =
      !res.ok ||
      (body !== null &&
        typeof body === "object" &&
        ("error" in body || "error_type" in body))
    if (hasError) throw parseMetaError(res.status, body)
    if (body === null) {
      throw new MetaApiError("transient", "Instagram returned an empty response", {
        status: res.status,
      })
    }
    return body as T
  }

  // --------------------------------------------------------------- OAuth

  authorizeUrl(params: { appId: string; redirectUri: string; state: string }): string {
    const url = new URL("https://www.instagram.com/oauth/authorize")
    url.searchParams.set("client_id", params.appId)
    url.searchParams.set("redirect_uri", params.redirectUri)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","))
    url.searchParams.set("state", params.state)
    return url.toString()
  }

  async exchangeCode(params: {
    appId: string
    appSecret: string
    redirectUri: string
    code: string
  }): Promise<{ accessToken: string; userId: string; permissions: string[] }> {
    const form = new URLSearchParams({
      client_id: params.appId,
      client_secret: params.appSecret,
      grant_type: "authorization_code",
      redirect_uri: params.redirectUri,
      code: params.code,
    })
    type Entry = { access_token: string; user_id: string | number; permissions?: string | string[] }
    const body = await this.request<Entry | { data: Entry[] }>(
      `${OAUTH_HOST}/oauth/access_token`,
      { method: "POST", body: form },
    )
    // Meta has returned both a flat object and a { data: [...] } wrapper.
    const entry = "data" in body ? body.data[0] : body
    if (!entry?.access_token) {
      throw new MetaApiError("invalid", "Instagram did not return an access token")
    }
    const perms = entry.permissions
    return {
      accessToken: entry.access_token,
      userId: String(entry.user_id),
      permissions: Array.isArray(perms) ? perms : (perms ?? "").split(",").filter(Boolean),
    }
  }

  async exchangeForLongLived(params: {
    appSecret: string
    shortLivedToken: string
  }): Promise<TokenResult> {
    const url = new URL(`${GRAPH_HOST}/access_token`)
    url.searchParams.set("grant_type", "ig_exchange_token")
    url.searchParams.set("client_secret", params.appSecret)
    url.searchParams.set("access_token", params.shortLivedToken)
    const body = await this.request<{ access_token: string; expires_in: number }>(
      url.toString(),
    )
    return { accessToken: body.access_token, expiresInSeconds: body.expires_in }
  }

  /** Only valid once the token is at least 24 hours old and not yet expired. */
  async refreshLongLived(token: string): Promise<TokenResult> {
    const url = new URL(`${GRAPH_HOST}/refresh_access_token`)
    url.searchParams.set("grant_type", "ig_refresh_token")
    url.searchParams.set("access_token", token)
    const body = await this.request<{ access_token: string; expires_in: number }>(
      url.toString(),
    )
    return { accessToken: body.access_token, expiresInSeconds: body.expires_in }
  }

  // ------------------------------------------------------------- account

  async getProfile(token: string): Promise<InstagramProfile> {
    const body = await this.request<{
      id?: string
      user_id?: string | number
      username: string
      profile_picture_url?: string
      account_type?: string
    }>(`${this.graph}/me?fields=id,user_id,username,profile_picture_url,account_type`, {
      token,
    })
    const userId = body.user_id !== undefined ? String(body.user_id) : body.id
    if (!userId) throw new MetaApiError("invalid", "Instagram did not return an account ID")
    return {
      userId,
      scopedId: body.id ?? null,
      username: body.username,
      profilePictureUrl: body.profile_picture_url ?? null,
      accountType: body.account_type ?? null,
    }
  }

  /**
   * Subscribes this account to the comments and messages webhook fields.
   * Required per account: without it Meta sends nothing for the account.
   */
  async subscribeToWebhooks(token: string): Promise<void> {
    const body = await this.request<{ success?: boolean }>(
      `${this.graph}/me/subscribed_apps?subscribed_fields=${WEBHOOK_FIELDS.join(",")}`,
      { method: "POST", token },
    )
    if (body.success !== true) {
      throw new MetaApiError("invalid", "Instagram did not confirm the webhook subscription")
    }
  }

  async unsubscribe(token: string): Promise<void> {
    await this.request<{ success?: boolean }>(`${this.graph}/me/subscribed_apps`, {
      method: "DELETE",
      token,
    })
  }

  // --------------------------------------------------------------- media

  async listMedia(
    token: string,
    after?: string,
    limit = 24,
  ): Promise<{ items: MediaItem[]; nextCursor: string | null }> {
    const url = new URL(`${this.graph}/me/media`)
    url.searchParams.set("fields", MEDIA_FIELDS)
    url.searchParams.set("limit", String(limit))
    if (after) url.searchParams.set("after", after)
    const body = await this.request<{
      data: RawMedia[]
      paging?: { cursors?: { after?: string }; next?: string }
    }>(url.toString(), { token })
    return {
      items: body.data.map(toMediaItem),
      nextCursor: body.paging?.next ? body.paging.cursors?.after ?? null : null,
    }
  }

  /** Fails unless this token can see the media, which proves ownership. */
  async getMedia(token: string, mediaId: string): Promise<MediaItem> {
    const url = new URL(`${this.graph}/${encodeURIComponent(mediaId)}`)
    url.searchParams.set("fields", MEDIA_FIELDS)
    return toMediaItem(await this.request<RawMedia>(url.toString(), { token }))
  }

  // ------------------------------------------------------------ comments

  /** Public reply under the comment. */
  async replyToComment(token: string, commentId: string, message: string): Promise<string> {
    const body = await this.request<{ id: string }>(
      `${this.graph}/${encodeURIComponent(commentId)}/replies`,
      {
        method: "POST",
        token,
        body: new URLSearchParams({ message }),
      },
    )
    return body.id
  }

  /**
   * Private reply: a DM to the commenter, addressed by comment ID. Allowed
   * once per comment, within 7 days of the comment.
   */
  async sendPrivateReply(token: string, commentId: string, text: string): Promise<string> {
    const body = await this.request<{ message_id?: string; recipient_id?: string }>(
      `${this.graph}/me/messages`,
      {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { comment_id: commentId },
          message: { text },
        }),
      },
    )
    return body.message_id ?? ""
  }

  // ------------------------------------------------------------ insights

  async getFollowersCount(token: string): Promise<number | null> {
    const body = await this.request<{ followers_count?: number }>(
      `${this.graph}/me?fields=followers_count`,
      { token },
    )
    return typeof body.followers_count === "number" ? body.followers_count : null
  }

  /**
   * Account insights as totals over [since, until), in unix seconds. Every
   * metric in one call must support the same breakdown, or Meta rejects the
   * whole request.
   */
  async getAccountInsights(
    token: string,
    params: { metrics: readonly string[]; since: number; until: number; breakdown?: string },
  ): Promise<Map<string, AccountMetricValue>> {
    const url = new URL(`${this.graph}/me/insights`)
    url.searchParams.set("metric", params.metrics.join(","))
    url.searchParams.set("period", "day")
    url.searchParams.set("metric_type", "total_value")
    url.searchParams.set("since", String(params.since))
    url.searchParams.set("until", String(params.until))
    if (params.breakdown) url.searchParams.set("breakdown", params.breakdown)
    return parseAccountInsights(await this.request<unknown>(url.toString(), { token }))
  }

  /** Lifetime insights for one media object. */
  async getMediaInsights(
    token: string,
    mediaId: string,
    metrics: readonly string[],
  ): Promise<Map<string, number | null>> {
    const url = new URL(`${this.graph}/${encodeURIComponent(mediaId)}/insights`)
    url.searchParams.set("metric", metrics.join(","))
    return parseMediaInsights(await this.request<unknown>(url.toString(), { token }))
  }

  /**
   * One page of DM conversations with their participants and up to the 20
   * newest messages' sender and time. Message text is not requested.
   */
  async listConversations(
    token: string,
    after?: string,
  ): Promise<{ threads: BackfillThread[]; nextCursor: string | null }> {
    const url = new URL(`${this.graph}/me/conversations`)
    url.searchParams.set("platform", "instagram")
    url.searchParams.set("fields", "participants,updated_time,messages.limit(20){created_time,from}")
    url.searchParams.set("limit", "25")
    if (after) url.searchParams.set("after", after)
    return parseConversations(await this.request<unknown>(url.toString(), { token }))
  }
}
