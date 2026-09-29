-- Content Analytics: stored Instagram insights, media, and DM conversation
-- metadata, plus the sync bookkeeping that fills them.
--
-- Same security model as the dashboard migration: row level security on with
-- NO policies, privileges revoked from anon and authenticated, and every read
-- and write done server side with the service role key.
--
-- Nullable metric columns mean "Instagram did not report this". A stored 0 is
-- always a real zero from the API, never a stand in for unknown.

-------------------------------------------------------------------------------
-- Client time zone (dates on the analytics page are shown in it)
-------------------------------------------------------------------------------

alter table public.clients
  add column if not exists timezone text not null default 'Asia/Kolkata';

alter table public.clients drop constraint if exists clients_timezone_format;
alter table public.clients
  add constraint clients_timezone_format
  check (timezone ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+){0,2}$' and char_length(timezone) <= 64);

comment on column public.clients.timezone is
  'IANA time zone used to show analytics dates, for example Asia/Kolkata or America/New_York.';

-------------------------------------------------------------------------------
-- Scopes granted at connect time, and the automation DM timestamp
-------------------------------------------------------------------------------

alter table public.instagram_accounts
  add column if not exists granted_scopes text[];

comment on column public.instagram_accounts.granted_scopes is
  'Permissions Instagram reported at the last connect. Null when Instagram did not say.';

-- When the private reply DM went out. Used to attribute a later inbound DM
-- to the automation that started the conversation.
alter table public.comment_events
  add column if not exists dm_sent_at timestamptz;

create index if not exists comment_events_commenter_dm_idx
  on public.comment_events (ig_user_id, commenter_id, dm_sent_at)
  where dm_status = 'sent';

-------------------------------------------------------------------------------
-- Per account analytics state
-------------------------------------------------------------------------------

create table if not exists public.ig_analytics_state (
  instagram_account_id uuid primary key
    references public.instagram_accounts(id) on delete cascade,
  insights_status text not null default 'unknown'
    check (insights_status in ('unknown', 'ok', 'missing_permission')),
  -- First Meta day the backfill covers. Fixed at the first sync.
  backfill_start_date date,
  backfill_completed_at timestamptz,
  last_synced_at timestamptz,
  -- When live DM tracking (the messages webhook) was switched on.
  dm_tracking_started_at timestamptz,
  dm_backfill_cursor text,
  dm_backfill_completed_at timestamptz,
  -- { "<metric>": { "available": bool, "reason": text, "checkedAt": iso } }
  metric_availability jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists ig_analytics_state_updated_at on public.ig_analytics_state;
create trigger ig_analytics_state_updated_at
  before update on public.ig_analytics_state
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Daily account metrics (one row per Meta day)
-------------------------------------------------------------------------------

create table if not exists public.ig_account_daily_metrics (
  instagram_account_id uuid not null
    references public.instagram_accounts(id) on delete cascade,
  date date not null,
  views bigint check (views >= 0),
  likes bigint check (likes >= 0),
  comments bigint check (comments >= 0),
  shares bigint check (shares >= 0),
  saves bigint check (saves >= 0),
  follows bigint check (follows >= 0),
  unfollows bigint check (unfollows >= 0),
  profile_visits bigint check (profile_visits >= 0),
  -- Holds profile_links_taps: taps on contact buttons. Instagram's API has no
  -- metric for taps on the bio link itself. See docs/ANALYTICS.md.
  bio_link_taps bigint check (bio_link_taps >= 0),
  reach bigint check (reach >= 0),
  -- Snapshot of followers_count, only for days a sync ran. Instagram's API
  -- has no follower history, so earlier days stay null.
  follower_count bigint check (follower_count >= 0),
  -- Set only when every request for the day succeeded. Null means the day
  -- still needs fetching.
  fetched_at timestamptz,
  primary key (instagram_account_id, date)
);

comment on column public.ig_account_daily_metrics.bio_link_taps is
  'Instagram profile_links_taps: taps on call, email, text, directions and booking buttons. Not bio link taps, which the API does not report.';

-------------------------------------------------------------------------------
-- Media and their lifetime insights
-------------------------------------------------------------------------------

create table if not exists public.ig_media (
  media_id text primary key,
  instagram_account_id uuid not null
    references public.instagram_accounts(id) on delete cascade,
  media_type text,
  media_product_type text,
  caption text,
  permalink text,
  thumbnail_url text,
  "timestamp" timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ig_media_account_time_idx
  on public.ig_media (instagram_account_id, "timestamp" desc);

drop trigger if exists ig_media_updated_at on public.ig_media;
create trigger ig_media_updated_at
  before update on public.ig_media
  for each row execute function public.set_updated_at();

-- Latest lifetime snapshot per media. Not per period.
create table if not exists public.ig_media_insights (
  media_id text primary key references public.ig_media(media_id) on delete cascade,
  views bigint check (views >= 0),
  reach bigint check (reach >= 0),
  likes bigint check (likes >= 0),
  comments bigint check (comments >= 0),
  shares bigint check (shares >= 0),
  saves bigint check (saves >= 0),
  total_interactions bigint,
  avg_watch_time_ms bigint check (avg_watch_time_ms >= 0),
  -- Instagram reports these for feed posts and stories only, never reels.
  follows bigint check (follows >= 0),
  profile_visits bigint check (profile_visits >= 0),
  fetched_at timestamptz not null default now()
);

-------------------------------------------------------------------------------
-- DM conversations (metadata only, never message contents)
-------------------------------------------------------------------------------

create table if not exists public.ig_conversations (
  id uuid primary key default gen_random_uuid(),
  instagram_account_id uuid not null
    references public.instagram_accounts(id) on delete cascade,
  -- The other person's Instagram scoped ID.
  thread_key text not null,
  -- Their first inbound message. Null when the thread predates tracking and
  -- its first inbound message could not be read (Instagram only exposes the
  -- 20 newest messages). Such rows mark the sender as known and are never
  -- counted as new DMs.
  first_inbound_at timestamptz,
  source text not null check (source in ('webhook', 'backfill')),
  created_via_automation boolean not null default false,
  created_at timestamptz not null default now(),
  unique (instagram_account_id, thread_key)
);

create index if not exists ig_conversations_account_time_idx
  on public.ig_conversations (instagram_account_id, first_inbound_at);

-------------------------------------------------------------------------------
-- Sync runs
-------------------------------------------------------------------------------

create table if not exists public.ig_sync_runs (
  id uuid primary key default gen_random_uuid(),
  instagram_account_id uuid not null
    references public.instagram_accounts(id) on delete cascade,
  trigger text not null check (trigger in ('cron', 'manual', 'connect', 'continuation')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  error text,
  api_calls integer not null default 0
);

create index if not exists ig_sync_runs_account_idx
  on public.ig_sync_runs (instagram_account_id, started_at desc);
create index if not exists ig_sync_runs_running_idx
  on public.ig_sync_runs (instagram_account_id) where status = 'running';

-------------------------------------------------------------------------------
-- Functions (service role only)
-------------------------------------------------------------------------------

-- Starts a sync run unless one is already running or the last one started
-- within p_min_interval. A run left "running" for 5 minutes belongs to a
-- crashed worker and is closed as failed first. Returns one row:
-- outcome 'started' (with run_id), 'busy', or 'throttled' (with
-- retry_after_seconds).
create or replace function public.start_ig_sync_run(
  p_account_id uuid,
  p_trigger text,
  p_min_interval interval
)
returns table (run_id uuid, outcome text, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last timestamptz;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('ig-sync:' || p_account_id::text, 0));

  update public.ig_sync_runs
  set status = 'failed',
      finished_at = now(),
      error = coalesce(error, 'The sync was interrupted before it finished.')
  where instagram_account_id = p_account_id
    and status = 'running'
    and started_at < now() - interval '5 minutes';

  if exists (
    select 1 from public.ig_sync_runs
    where instagram_account_id = p_account_id and status = 'running'
  ) then
    return query select null::uuid, 'busy'::text, null::integer;
    return;
  end if;

  if p_min_interval is not null then
    select max(started_at) into v_last
    from public.ig_sync_runs
    where instagram_account_id = p_account_id;

    if v_last is not null and v_last > now() - p_min_interval then
      return query select
        null::uuid,
        'throttled'::text,
        greatest(1, ceil(extract(epoch from (v_last + p_min_interval - now())))::integer);
      return;
    end if;
  end if;

  insert into public.ig_sync_runs (instagram_account_id, trigger)
  values (p_account_id, p_trigger)
  returning id into v_id;

  return query select v_id, 'started'::text, null::integer;
end;
$$;

-- Records an inbound DM from the messages webhook. Inserts the sender's
-- conversation the first time they message this account, attributing it to
-- an automation when that person was sent an automation DM before this
-- message. A repeat sender changes nothing, except that an earlier message
-- delivered late moves first_inbound_at back for webhook tracked rows.
-- Returns true when this was a new conversation.
create or replace function public.record_inbound_dm(
  p_account_id uuid,
  p_thread_key text,
  p_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_via_automation boolean;
  v_inserted boolean;
begin
  select exists (
    select 1
    from public.comment_events e
    join public.instagram_accounts a on a.ig_user_id = e.ig_user_id
    where a.id = p_account_id
      and e.commenter_id = p_thread_key
      and e.dm_status = 'sent'
      and e.dm_sent_at is not null
      and e.dm_sent_at <= p_at
  ) into v_via_automation;

  insert into public.ig_conversations as c (
    instagram_account_id, thread_key, first_inbound_at, source, created_via_automation
  ) values (
    p_account_id, p_thread_key, p_at, 'webhook', v_via_automation
  )
  on conflict (instagram_account_id, thread_key) do update
    set first_inbound_at = excluded.first_inbound_at,
        created_via_automation = excluded.created_via_automation
    where c.source = 'webhook'
      and c.first_inbound_at is not null
      and excluded.first_inbound_at < c.first_inbound_at
  returning (xmax = 0) into v_inserted;

  return coalesce(v_inserted, false);
end;
$$;

-- Marks conversations as automation driven when an automation DM to that
-- person went out before their first inbound message. Catches the race where
-- someone replies before the DM's sent state was saved. Returns rows changed.
create or replace function public.reconcile_dm_attribution(p_account_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.ig_conversations c
  set created_via_automation = true
  from public.instagram_accounts a
  where c.instagram_account_id = p_account_id
    and a.id = p_account_id
    and not c.created_via_automation
    and c.first_inbound_at is not null
    and exists (
      select 1
      from public.comment_events e
      where e.ig_user_id = a.ig_user_id
        and e.commenter_id = c.thread_key
        and e.dm_status = 'sent'
        and e.dm_sent_at is not null
        and e.dm_sent_at <= c.first_inbound_at
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- New DMs per day in the client's time zone, split organic vs automation.
create or replace function public.ig_new_dm_daily(
  p_account_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_tz text
)
returns table (day date, organic bigint, automation bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (c.first_inbound_at at time zone p_tz)::date as day,
    count(*) filter (where not c.created_via_automation) as organic,
    count(*) filter (where c.created_via_automation) as automation
  from public.ig_conversations c
  where c.instagram_account_id = p_account_id
    and c.first_inbound_at is not null
    and c.first_inbound_at >= p_from
    and c.first_inbound_at < p_to
  group by 1
  order by 1;
$$;

-- Wipes stored analytics for an account row, used when a different
-- Instagram account replaces it so old numbers never show under the new one.
create or replace function public.reset_ig_analytics(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.ig_account_daily_metrics where instagram_account_id = p_account_id;
  delete from public.ig_media where instagram_account_id = p_account_id;
  delete from public.ig_conversations where instagram_account_id = p_account_id;
  delete from public.ig_sync_runs where instagram_account_id = p_account_id;
  delete from public.ig_analytics_state where instagram_account_id = p_account_id;
end;
$$;

revoke all on function public.start_ig_sync_run(uuid, text, interval) from public, anon, authenticated;
revoke all on function public.record_inbound_dm(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.reconcile_dm_attribution(uuid) from public, anon, authenticated;
revoke all on function public.ig_new_dm_daily(uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public.reset_ig_analytics(uuid) from public, anon, authenticated;
grant execute on function public.start_ig_sync_run(uuid, text, interval) to service_role;
grant execute on function public.record_inbound_dm(uuid, text, timestamptz) to service_role;
grant execute on function public.reconcile_dm_attribution(uuid) to service_role;
grant execute on function public.ig_new_dm_daily(uuid, timestamptz, timestamptz, text) to service_role;
grant execute on function public.reset_ig_analytics(uuid) to service_role;

-------------------------------------------------------------------------------
-- Lock everything down
-------------------------------------------------------------------------------

alter table public.ig_analytics_state enable row level security;
alter table public.ig_account_daily_metrics enable row level security;
alter table public.ig_media enable row level security;
alter table public.ig_media_insights enable row level security;
alter table public.ig_conversations enable row level security;
alter table public.ig_sync_runs enable row level security;

revoke all on table public.ig_analytics_state from anon, authenticated;
revoke all on table public.ig_account_daily_metrics from anon, authenticated;
revoke all on table public.ig_media from anon, authenticated;
revoke all on table public.ig_media_insights from anon, authenticated;
revoke all on table public.ig_conversations from anon, authenticated;
revoke all on table public.ig_sync_runs from anon, authenticated;

-------------------------------------------------------------------------------
-- One off: automation DMs sent before dm_sent_at existed. processed_at is
-- written seconds after the DM, so attribution stays conservative.
-------------------------------------------------------------------------------

update public.comment_events
set dm_sent_at = coalesce(processed_at, last_attempt_at)
where dm_status = 'sent'
  and dm_sent_at is null
  and coalesce(processed_at, last_attempt_at) is not null;
