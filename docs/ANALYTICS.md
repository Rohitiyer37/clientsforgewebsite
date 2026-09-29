# Content Analytics: Instagram

Setup, data sources, and limits for `clientsforge.com/dashboard/analytics`.
It extends the dashboard described in `AUTOMATIONS_SETUP.md` and reuses its
PIN sessions, encrypted tokens, Graph client, webhook, and cron pattern.

No DM data is sourced. The analytics never read the inbox, never subscribe to
the `messages` webhook, and store nothing about who messaged the account.

## 1. Metric mapping

Checked against Meta's Instagram Platform references (IG User Insights, IG
Media Insights, the Insights guide) on 28 September 2026, and against the
live API on 29 September 2026 with a real account. The latest Graph API
version is v26.0; the app calls `META_GRAPH_API_VERSION`, default v25.0.
Every metric below was confirmed on both.

| Dashboard label | API metric | Endpoint and params | Caveats |
| --- | --- | --- | --- |
| Views | `views` | `GET /me/insights?metric=views,...&period=day&metric_type=total_value&since&until` | Replaced `impressions` and `plays` (April 2025). Includes replays. |
| Likes | `likes` | same call | Posts, reels, and videos. |
| Comments | `comments` | same call | |
| Follows | `follows_and_unfollows`, breakdown `FOLLOWER` | `...&metric=follows_and_unfollows&breakdown=follow_type` | Not returned for accounts under 100 followers (shown as "Not available"). `NON_FOLLOWER` is stored as `unfollows`. |
| Profile Visits | `profile_views` | own request per day | **Not listed in Meta's current reference, but served** (confirmed live on v25.0 and v26.0). Probed weekly; if Meta stops serving it, the card and funnel stage show "Not available". |
| Bio Link Taps | `website_clicks` | same request as Profile Visits | Taps on the link in the bio. **Not listed in the current reference, but served** (confirmed live). Probed weekly, like Profile Visits. Not to be confused with `profile_links_taps`, which counts contact buttons (call, email, text, directions, booking). |
| (stored) Reach | `reach` | with Views | Daily unique accounts. Not summed on screen: uniques do not add across days. |
| (stored) Shares, Saves | `shares`, `saves` | with Views | |
| (stored) Follower count | `followers_count` field | `GET /me?fields=followers_count` | No history in the API. Snapshotted on each sync. |
| Reel views, likes, comments, shares, saves | `views`, `likes`, `comments`, `shares`, `saved` | `GET /{media-id}/insights?metric=...` | Lifetime totals, not per period. Labelled as such. |
| Reel avg watch time | `ig_reels_avg_watch_time` | same call | **Milliseconds** (confirmed live: 8100 = 8.1 s, consistent with `ig_reels_video_view_total_time` / views). |

**Supported types.** These account metrics support `metric_type=total_value`
with `period=day`; only `reach` also supports `time_series`. Each Meta day is
fetched as its own `total_value` request, which sidesteps any range limit.

**Day windows (important).** Meta keys each daily bucket by its `end_time`,
the Pacific midnight that ends the day, and a request includes every bucket
whose `end_time` is within `[since, until]` inclusive. A midnight to midnight
window therefore returns two days. The sync uses `since = start of day + 1s`,
`until = end of day`, which returns exactly one. Verified live: seven such
windows summed exactly to one 7 day request (4,082 = 4,082), and each matched
the `reach` time series for that day. See `metaDayWindow` in
`server/analytics/dates.ts`.

**Retention.** Account insights are kept by Meta for 90 days, media insights
for 2 years, and data can lag up to 48 hours. The backfill covers 90 days;
longer history exists only because we store it.

**Day boundaries.** Each stored row is one Pacific day. The page shows dates
in the client's time zone (`clients.timezone`, default Asia/Kolkata) and
footnotes the offset.

**Empty is not zero.** Null means Instagram did not report it, and the UI says
"Not available". A stored 0 is always a real 0.

## 2. Data flow

```
   scheduled-sync-analytics (every 6 h)   /api/analytics/instagram/refresh   Instagram connect callback
                        │                 (15 min throttle)                            │
                        └───────────────────────┬──────────────────────────────────────┘
                                                ▼
                     start_ig_sync_run (lock + throttle) ── run row in ig_sync_runs
                                                │  POST with CRON_SECRET
                                                ▼
   /.netlify/functions/sync-analytics-background  (background function: 202 at
                                     once, 15 min limit, run budget 10 min)
                                                │
                                                ▼
                               runSync (server/instagram/analytics-sync.ts)
   1. probe insights access (1 call)                      → insights_status ok | missing_permission
   2. followers_count snapshot                            → ig_account_daily_metrics.follower_count
   3. probe profile_views and website_clicks (weekly)     → metric_availability
   4. last 3 days + any unfetched day of 90, newest first → ig_account_daily_metrics
   5. /me/media (last 90 days) → ig_media;  reel insights (recent every run, older weekly) → ig_media_insights
        stops starting new requests at 80% of Meta's quota, on the deadline, or on a token error

 Browser ──▶ GET /api/analytics/instagram?range=30d | ?from&to
             service.ts reads stored rows only, compute.ts aggregates (pure, tested)
```

Syncs run in a background function because a first backfill (about 280
calls) can outlast the 60 second limit of a normal function. Netlify does not
route custom paths to background functions, so the worker is called at its
default `/.netlify/functions/` address. Progress (permission status, metric
availability, each fetched day) is saved as it happens, so a run that is cut
off still leaves accurate state. A run still "running" after 12 minutes is
closed as failed by the next start. While the first backfill is unfinished,
the open page continues it about once a minute and polls
`/api/analytics/instagram/status`.

## 3. Tables

Created by `supabase/migrations/20260928000000_instagram_analytics.sql`, then
`20260929000000_remove_dm_tracking.sql` removes DM tracking. Both are applied
to ClientsForge; run them in order on a fresh project. Row level security is
on with no policies, and privileges are revoked from `anon` and
`authenticated`. Every table cascades from `instagram_accounts`, so the data
deletion callback removes all of it.

| Table | Holds |
| --- | --- |
| `ig_account_daily_metrics` | One row per Pacific day. Nullable metrics. `fetched_at` is set only when every request for the day succeeded. |
| `ig_media` | Posts and reels (caption, permalink, thumbnail, publish time). |
| `ig_media_insights` | Latest lifetime snapshot per media. |
| `ig_sync_runs` | Every sync: trigger, timing, status, error, API calls. |
| `ig_analytics_state` | Per account: insights permission, backfill progress, metric availability. |

New columns: `clients.timezone` (change it in the Table editor to an IANA
name such as `America/New_York`), `instagram_accounts.granted_scopes`, and
`comment_events.dm_sent_at` (when an automation's own reply went out; audit
only).

## 4. Funnel and benchmarks

Stages: Views, Profile Visits, Follows. Each stage converts from the nearest
stage above it that Instagram reported, and the label names that pair, so an
unavailable stage never produces a wrong percentage. Nothing divides by zero
or null.

Benchmarks and the one line hints live in `server/analytics/benchmarks.ts`.
The defaults are editable starting points, not Meta figures. The leak callout
flags the step furthest below its benchmark's low end, and says "Weakest step"
when every step is healthy.

## 5. Operations

| Job | Schedule | Manual trigger |
| --- | --- | --- |
| Sync every account | Every 6 hours (`scheduled-sync-analytics`) | `POST /api/cron/sync-analytics` |
| Sync one account | | `POST /api/cron/sync-analytics?account=<instagram_accounts.id>` |

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://clientsforge.com/api/cron/sync-analytics?account=<id>"
```

- **Rate limits.** `X-App-Usage` and `X-Business-Use-Case-Usage` are read on
  every response. At 80% of any counter the run stops starting requests and
  closes as `partial`. The first backfill is about 280 calls (3 per day for
  90 days, plus media and reels); later runs are about 15 plus one per recent
  reel.
- **Token expiry.** A token error marks the account `expired`, which shows the
  Reconnect banner on both Automations and Analytics.
- **Logs.** `analytics_sync_finished` with `accountId`, `runId`, status, API
  calls, and counts. Tokens are never logged.
- **Webhooks.** Only the `comments` field is used. Each account is subscribed
  with `subscribed_fields=comments`, which also removes any other field.
- **No new environment variables.** `vercel.json` is still unused; the
  schedule is declared in `netlify/functions/scheduled-sync-analytics.mts`.

## 6. Known limits

- Profile visits and bio link taps depend on metrics Meta no longer documents.
  They work today; if Meta switches them off, the weekly probe marks them
  "Not available" automatically.
- Follows need 100+ followers.
- Account metrics only go back 90 days from the first sync.
- Follower count has no history before the first sync.
- Top reels use lifetime totals, labelled as such.
