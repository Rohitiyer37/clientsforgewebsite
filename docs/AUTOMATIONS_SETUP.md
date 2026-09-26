# Client Dashboard and Instagram Comment to DM Automation

Setup and operations guide for `clientsforge.com/dashboard`.

## 1. Architecture

The site is a Vite + React single page app on **Netlify**. Server code runs as
**Netlify Functions** (Node 22) in the same deploy, so everything lives on one
origin. The original brief assumed Next.js on Vercel. The table maps each piece
to what was built instead.

| Brief (Next.js on Vercel)          | Built (Vite on Netlify)                              |
| ---------------------------------- | ---------------------------------------------------- |
| Route handlers / server actions    | `netlify/functions/*.mts` with `config.path`         |
| `waitUntil` from `@vercel/functions` | `context.waitUntil` (Netlify Functions)            |
| Vercel Cron in `vercel.json`       | Netlify Scheduled Functions (`config.schedule`)      |
| Next middleware on `/dashboard/*`  | A route gate in React plus server side session checks on every API |

```
Instagram ──webhook──▶ /api/webhooks/instagram
                        1. verify X-Hub-Signature-256 (raw bytes, constant time)
                        2. insert into comment_events  ON CONFLICT DO NOTHING
                        3. respond 200 immediately
                        4. context.waitUntil(processEvents)
                                   │
                                   ▼
                        processCommentEvent(id)
                          claim row atomically (claim_comment_event)
                          account active? self comment? matching automation?
                          inside 7 day window?
                          public reply  ──▶ Graph API  (result saved at once)
                          private reply ──▶ Graph API  (result saved at once)
                                   │
          every 5 min ─────────────┘  /api/cron/retry-events retries failures
```

**Security model.**
- Every table has row level security on with no policies, and privileges are
  revoked from `anon` and `authenticated`. The public key can read nothing.
  This was verified against the live REST API.
- All data access goes through Netlify Functions with the service role key.
  Every dashboard query is scoped by the `client_id` from `getCurrentClient()`,
  never from request input.
- Sessions use a 32 byte random token in an `httpOnly`, `Secure`,
  `SameSite=Lax` cookie. Only its SHA-256 hash is stored.
- Instagram tokens are encrypted with AES-256-GCM and decrypted only at the
  moment of use. They are never sent to the browser or logged.
- State changing APIs reject cross origin requests.

## 2. Where things live

| Path | Purpose |
| --- | --- |
| `supabase/migrations/20260926000000_client_dashboard.sql` | Full schema. This is also the combined SQL to paste into the SQL editor. Already applied to ClientsForge. |
| `server/` | All server logic: session, crypto, rate limit, Graph client, processor, jobs |
| `server/instagram/client.ts` | The one typed Graph API client (timeouts, parsed Meta errors) |
| `server/automations/processor.ts` | `processCommentEvent`, the engine |
| `server/automations/rules.ts` | Pure decision rules (7 day window, self comment, selection) |
| `shared/` | Zod schemas, keyword matching, and DM composition, shared by UI and server |
| `netlify/functions/` | One file per endpoint or scheduled job |
| `src/pages/dashboard/`, `src/dashboard/` | Dashboard UI |
| `src/pages/legal/` | `/privacy`, `/terms`, `/data-deletion` |

## 3. Environment variables

Set these in Netlify under **Site configuration > Environment variables**.
Every one is documented in `.env.example`. None may have a `VITE_` prefix.

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | ClientsForge project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret. Server only. |
| `APP_BASE_URL` | `https://clientsforge.com`, no trailing slash |
| `SESSION_SECRET` | Signs OAuth state |
| `TOKEN_ENCRYPTION_KEY` | 32 bytes, base64. Rotating it forces every client to reconnect. |
| `META_WEBHOOK_VERIFY_TOKEN` | Also pasted into Meta webhook settings |
| `CRON_SECRET` | Guards `/api/cron/*` |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | From the Meta app |
| `META_GRAPH_API_VERSION` | `v25.0` |

Redeploy after changing any variable. Functions read them at startup.

## 4. Clients and PINs

**Add a client.** In Supabase, open **Table editor > clients > Insert row**.
Fill in `name` and type a PIN of 8+ characters into `pin`, then save. A
trigger hashes it into `pin_hash` (bcrypt) and clears `pin`, so the plaintext
is never stored. Share the PIN with the client privately.

- A PIN under 8 characters, or one already used by another active client, is
  rejected with an error.
- **Change a PIN:** type a new value into `pin` on that row and save.
- **Lock a client out:** set `is_active` to `false`. They are signed out on
  their next request.
- **Sign a client out everywhere:** delete their rows in `client_sessions`.

Login allows 5 failed attempts per IP per 15 minutes. Every attempt is
recorded in `login_attempts`. A wrong PIN always shows the same message, so
nobody can learn whether a PIN exists.

## 5. Meta App Dashboard setup

Create an app with the **Instagram API with Instagram Login** product (not
Facebook Login).

1. **Instagram > API setup with Instagram login > Set up Instagram business login**
   - OAuth redirect URI: `https://clientsforge.com/api/instagram/callback`
2. **Webhooks** (same screen)
   - Callback URL: `https://clientsforge.com/api/webhooks/instagram`
   - Verify token: the value of `META_WEBHOOK_VERIFY_TOKEN`
   - Click **Verify and save**, then subscribe to the **`comments`** field.
3. **App settings > Basic**
   - Privacy Policy URL: `https://clientsforge.com/privacy`
   - Terms of Service URL: `https://clientsforge.com/terms`
   - Data deletion: choose **Data deletion callback URL** and enter
     `https://clientsforge.com/api/instagram/data-deletion`
4. **Instagram business login settings**
   - Deauthorize callback URL: `https://clientsforge.com/api/instagram/deauthorize`
   - Data deletion request URL: `https://clientsforge.com/api/instagram/data-deletion`

Each connected account is also subscribed individually
(`POST /me/subscribed_apps?subscribed_fields=comments`). The OAuth callback
does this automatically, and the connection fails loudly if it does not work.

## 6. Testing before App Review

Meta only sends webhooks when the app is **Live**. Before App Review:

1. Add your Instagram account under **App roles > Roles > Instagram testers**,
   then accept the invite in Instagram (**Settings > Website permissions >
   Apps and websites > Tester invites**).
2. Switch the app to **Live** in the top bar. Without Advanced Access,
   permissions still work for accounts that hold a role on the app, which is
   what you want for testing.
3. The commenting account in the test should be a **different** Instagram
   account. The engine skips comments from the connected account itself.

## 7. End to end test plan

1. Insert a client row with a test PIN (section 4).
2. Visit `/dashboard`, enter the PIN, and confirm you see "Hey {name}".
3. Enter a wrong PIN 5 times from another browser, and confirm the 6th attempt
   says "Too many attempts".
4. Open **Automations**, click **Connect Instagram**, and approve every
   permission. Confirm the account card shows @username and Connected.
5. Click **New automation**. Pick a reel, choose keywords (for example
   `guide`), turn on a public reply, write a DM with a link, and activate it.
6. From a different Instagram account, comment `send the GUIDE!` on that reel.
7. Within a few seconds, confirm the public reply appears under the comment
   and the DM arrives in the commenter's inbox (check Message requests).
8. Open the automation's **Activity** tab. It should say "Replied publicly
   and sent the DM", and the list shows Matched 1, DMs sent 1.
9. Comment `nice reel` (no keyword). Nothing is sent.
10. Try activating a second automation on the same reel with the keyword
    `guide`, and confirm the overlap error.
11. Click **Disconnect**. Confirm automations are paused and the token is gone
    (`access_token_encrypted` is null in `instagram_accounts`).

Force a retry run at any time:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://clientsforge.com/api/cron/retry-events
```

## 8. App Review preparation

Request **Advanced Access** for each permission, with a screencast showing:

| Permission | The screencast must show |
| --- | --- |
| `instagram_business_basic` | Logging in to the dashboard, connecting Instagram through the consent screen, and the connected account's username and picture shown in the app. |
| `instagram_business_manage_comments` | Creating an automation on a reel, a comment being left from another account, and the public reply appearing under it. Also the activity log listing the comment. |
| `instagram_business_manage_messages` | The same comment receiving the private reply DM, shown in the commenter's inbox, with the DM text matching the automation. |

Also have ready: the privacy policy and terms (fill in the placeholders
first), the data deletion URL, a test PIN for the reviewer, and step by step
reviewer instructions based on section 7.

## 9. Operations

| Job | Schedule | Manual trigger |
| --- | --- | --- |
| Refresh tokens and housekeeping | Daily | `POST /api/cron/refresh-tokens` |
| Retry failed events | Every 5 minutes | `POST /api/cron/retry-events` |

- **Token refresh.** Tokens last 60 days and can only be refreshed once they
  are 24 hours old. Tokens expiring within 10 days are refreshed. An account is
  marked `expired` (the UI shows "Reconnect Instagram") when Meta rejects the
  token, or when a refresh fails with under 2 days left. A transient failure
  with time to spare waits for the next daily run.
- **Retries.** Retryable failures (rate limits, timeouts) get up to 3 attempts
  inside the 7 day window. Events left in `received` or stuck in `processing`
  are picked up too. A DM Meta confirmed is never re-sent: each step's result
  is saved the moment the API returns, and Meta itself allows only one private
  reply per comment.
- **Retention.** `comment_events` older than 90 days, expired sessions, and
  login attempts older than 30 days are deleted daily.
- **Logs.** Netlify > Logs > Functions. Every line is JSON with `eventId` and
  `clientId` where relevant. Tokens, PINs, cookies, and webhook bodies are
  never logged. Sensitive keys are also redacted automatically.

## 10. Decisions worth knowing

- **Links in DMs are text.** Private replies are documented for text only, so
  a labelled link is sent inline as `Label: https://...`. The builder preview
  shows exactly what is sent.
- **One Instagram account per workspace.** Webhooks are routed by account ID,
  so an account connected to one client cannot be connected to another.
- **Keyword matching** is case insensitive and whole word, ignores
  punctuation, treats iPhone curly apostrophes as straight ones, and matches
  multi word keywords as phrases. Keywords are stored in the exact form the
  matcher compares, so the overlap rule cannot be sidestepped with `guide!`
  versus `guide`.
- **Large IDs.** Instagram IDs exceed JavaScript's safe integer range. The
  webhook parser reads numeric IDs from their source digits so they are never
  rounded. This relies on Node 21+ (pinned to 22 in `.nvmrc`).
- **`vercel.json`** is left over from an earlier deploy target and is unused on
  Netlify.
