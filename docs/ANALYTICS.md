# Content Analytics: Instagram

Setup, data sources, and limits for `clientsforge.com/dashboard/analytics`.
It extends the dashboard described in `AUTOMATIONS_SETUP.md` and reuses its
PIN sessions, encrypted tokens, Graph client, webhook, and cron pattern.

## 1. Metric mapping

Verified on 28 September 2026 against Meta's Instagram Platform references for
the Instagram API with Instagram Login: IG User Insights
(`/{ig-user-id}/insights`), IG Media Insights (`/{ig-media-id}/insights`), the
Insights guide, and the Conversations API. The latest Graph API version is
v26.0; the app calls `META_GRAPH_API_VERSION`, default v25.0, which still
serves every metric below.

| Dashboard label | API metric | Endpoint and params | Caveats |
| --- | --- | --- | --- |
| Views | `views` | `GET /me/insights?metric=views&period=day&metric_type=total_value&since&until` | Replaced `impressions` and `plays` (April 2025). Includes replays. Meta marks it "in development". |
| Likes | `likes` | same call | Posts, reels, and videos. |
| Comments | `comments` | same call | "In development". |
| Follows | `follows_and_unfollows`, breakdown `FOLLOWER` | `...&metric=follows_and_unfollows&breakdown=follow_type&metric_type=total_value` | **Not returned for accounts with fewer than 100 followers.** Stored as null, shown as "Not available". `NON_FOLLOWER` is stored as `unfollows`. |
| Profile Visits | `profile_views` (removed) | probed weekly with a one day request | **Meta removed account-level `profile_views` in January 2025.** There is no replacement. Media level `profile_visits` exists only for feed posts and stories, not reels, so it cannot stand in. The card and funnel stage show "Not available" with that reason. If Meta ever serves it again, the weekly probe picks it up. |
| Contact Button Taps (asked for: Bio Link Taps) | `profile_links_taps` | same call as Views | **Not bio link taps.** Meta defines it as taps on the call, email, text, directions and booking buttons (`contact_button_type`: BOOK_NOW, CALL, DIRECTION, EMAIL, INSTANT_EXPERIENCE, TEXT). `website_clicks`, the old link metric, was removed in January 2025. Labelled accurately in the UI. |
| (stored) Reach | `reach` | same call | Daily unique accounts. Not summed on screen, because unique counts do not add across days. |
| (stored) Shares, Saves | `shares`, `saves` | same call | |
| (stored) Follower count | `followers_count` field | `GET /me?fields=followers_count` | Not an insights metric any more, so there is no history. Snapshotted on each sync from the day analytics connects. |
| Reel views | `views` | `GET /{media-id}/insights?metric=views,reach,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time` | Lifetime total, not per period. |
| Reel likes, comments, shares, saves | `likes`, `comments`, `shares`, `saved` | same call | Lifetime. Organic interactions only. |
| Reel avg watch time | `ig_reels_avg_watch_time` | same call | Meta's reference does not state the unit. It has historically been milliseconds; to be confirmed against a live reel once an account has granted insights access (section 7). |
| Reel follows / profile visits | `follows`, `profile_visits` | not requested for reels | Meta supports these for FEED and STORY only. |
| New DMs | derived | `messages` webhook, plus `GET /me/conversations?platform=instagram` backfill | No API metric exists. See section 4. |

**Supported types.** Every account metric above supports only
`metric_type=total_value` with `period=day`, except `reach`, which also
supports `time_series`. So each Meta day is fetched as its own
`total_value` request with a one day `since`/`until` window. That sidesteps
the per request range limit entirely.

**Range per request.** The current reference states no maximum `since`/`until`
span; without them it looks back 24 hours. Day sized windows are always
within any limit.

**Retention.** Account insights: "User Metrics data is stored for up to 90
days" (Insights guide). Media insights: "stored for up to 2 years". Data can
be delayed up to 48 hours. The backfill therefore covers 90 days, and history
beyond that exists only because we store it.

**Day boundaries.** Meta's daily buckets end at midnight US Pacific Time. Each
stored row is one Pacific day. The page shows dates in the client's time zone
(`clients.timezone`, default Asia/Kolkata) and footnotes the offset, for
example "each day's numbers here cover 12:30 pm to 12:30 pm the next day".

**Empty is not zero.** Meta documents that unavailable data returns an empty
set instead of 0. Every nullable column follows that: null means Instagram did
not report it, and the UI says "Not available". A stored 0 is always a real 0.

## 2. Data flow

```
                      every 6 h                      Refresh button (15 min throttle)
 scheduled-sync-analytics ──▶ /api/cron/sync-analytics?account=… ◀── /api/analytics/instagram/refresh
                                        │                                   │
                                        ▼                                   ▼
                          start_ig_sync_run (lock + throttle) ── run row in ig_sync_runs
                                        │
                                        ▼  context.waitUntil, 45 s budget
                               runSync (server/instagram/analytics-sync.ts)
   1. subscribe comments+messages webhooks (once)       → ig_analytics_state.dm_tracking_started_at
   2. probe insights access (1 call)                     → insights_status ok | missing_permission
   3. followers_count snapshot                           → ig_account_daily_metrics.follower_count
   4. profile_views probe (weekly)                       → metric_availability
   5. last 3 days + any unfetched day of 90, newest first → ig_account_daily_metrics
   6. /me/media (last 90 days) → ig_media;  reel insights (recent every run, older weekly) → ig_media_insights
   7. Conversations API backfill (resumable cursor)      → ig_conversations (source backfill)
   8. reconcile_dm_attribution
        stops starting new requests at 80% of Meta's quota, on the deadline, or on a token error

 Instagram ──webhook──▶ /api/webhooks/instagram
                        comments → existing automation pipeline (sets dm_sent_at when a DM goes out)
                        messages → 200 at once, then record_inbound_dm (first message per sender)

 Browser ──▶ GET /api/analytics/instagram?range=30d | ?from&to
             service.ts reads stored rows only, compute.ts aggregates (pure, tested)
```

A run that runs out of time leaves days without `fetched_at`; the next run
continues from there. While the first backfill is unfinished, the open page
continues it about once a minute and polls `/api/analytics/instagram/status`.

## 3. Tables

All in `supabase/migrations/20260928000000_instagram_analytics.sql` (already
applied to ClientsForge; paste it into the SQL editor for a fresh project).
Row level security is on with no policies, and privileges are revoked from
`anon` and `authenticated`. Every table cascades from `instagram_accounts`,
so the data deletion callback removes all of it.

| Table | Holds |
| --- | --- |
| `ig_account_daily_metrics` | One row per Pacific day. Nullable metrics. `fetched_at` is set only when every request for the day succeeded. |
| `ig_media` | Posts and reels (caption, permalink, thumbnail, publish time). |
| `ig_media_insights` | Latest lifetime snapshot per media. |
| `ig_conversations` | One row per person who has messaged the account. Metadata only. |
| `ig_sync_runs` | Every sync: trigger, timing, status, error, API calls. |
| `ig_analytics_state` | Per account: insights permission, backfill progress, DM tracking start, metric availability. |

New columns: `clients.timezone`, `instagram_accounts.granted_scopes`,
`comment_events.dm_sent_at`.

Change a client's time zone in the Table editor (`clients.timezone`, an IANA
name such as `America/New_York`).

## 4. New DMs

A new DM is the first inbound message from a person who had never messaged
the account before.

- **Live.** The `messages` webhook calls `record_inbound_dm`. Echoes (the
  account's own sends, including automation DMs), messages from the account's
  own IDs, read receipts, reactions, and deleted messages are ignored. The
  unique `(instagram_account_id, thread_key)` makes repeats a no op. Message
  text is never read or stored.
- **Attribution.** `created_via_automation` is true when an automation DM was
  sent to that person (`comment_events.dm_sent_at`) at or before their first
  message. Every sync re-checks this to catch the race where someone replies
  within a second of the DM.
- **Backfill.** On connect, the Conversations API seeds earlier threads.
  Instagram returns details for only the 20 newest messages per thread, and
  omits Requests folder threads inactive for 30 days. A thread whose full
  history is visible gets its exact first inbound time. Otherwise the sender is
  stored with a null time: known (so a later message is not miscounted as new)
  but never counted.
- **Tracking start.** `dm_tracking_started_at` is when the messages
  subscription went live. If the selected period starts before it, the funnel
  says "DM tracking started on {date}, so earlier DMs may not be counted."

## 5. Funnel and benchmarks

Stages: Views, Profile Visits, Follows, New DMs (Organic and From
Automations). Each stage converts from the nearest stage above it that
Instagram reported, and the label names that pair. Since profile visits are
unavailable, Follows shows "Views → Follows". Nothing divides by zero or null.

Benchmarks and the one line hints live in `server/analytics/benchmarks.ts`.
The defaults are editable starting points, not Meta figures. The leak callout
flags the step furthest below its benchmark's low end, and says "Weakest step"
when every step is healthy.

## 6. Operations

| Job | Schedule | Manual trigger |
| --- | --- | --- |
| Sync every account | Every 6 hours (`scheduled-sync-analytics`) | `POST /api/cron/sync-analytics` |
| Sync one account | | `POST /api/cron/sync-analytics?account=<instagram_accounts.id>` |

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://clientsforge.com/api/cron/sync-analytics?account=<id>"
```

- **Rate limits.** Every response's `X-App-Usage` and
  `X-Business-Use-Case-Usage` headers are read. At 80% of any counter the run
  stops starting requests and closes as `partial`; a rate limit error does the
  same. The first backfill is about 190 calls (2 per day for 90 days, plus
  media, reels, and conversations); later runs are about 10 plus one per recent
  reel.
- **Token expiry.** A token error marks the account `expired`, which shows the
  existing Reconnect banner on both Automations and Analytics.
- **Logs.** `analytics_sync_finished` with `accountId`, `runId`, status, API
  calls, and counts. Tokens and message contents are never logged.
- **No new environment variables.** The feature uses the existing ones.
- **`vercel.json`** is still unused. The six hourly schedule is declared in
  `netlify/functions/scheduled-sync-analytics.mts`.

## 7. Known limits

- Profile visits and bio link taps are not available from Instagram's API
  (section 1).
- Follows need 100+ followers.
- Account metrics only go back 90 days from the first sync.
- Follower count has no history before the first sync.
- DM counts before `dm_tracking_started_at` are best effort (section 4).
- Top reels use lifetime totals, labelled as such.
- Two assumptions still need a live check once an account grants insights
  access: that `ig_reels_avg_watch_time` is in milliseconds, and that one
  Pacific day window returns exactly one day (compare a 7 day sum with
  Instagram's in-app Insights). If either is off, adjust
  `server/instagram/analytics-sync.ts` or `server/analytics/dates.ts`.
