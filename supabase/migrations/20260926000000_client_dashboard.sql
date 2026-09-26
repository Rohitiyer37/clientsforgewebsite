-- Clientsforge client dashboard and Instagram comment to DM automation.
--
-- Security model: every table below has row level security enabled with NO
-- policies, and table privileges are revoked from anon and authenticated.
-- All reads and writes happen server side with the service role key. The
-- publishable (anon) key can read nothing here.

create extension if not exists pgcrypto with schema extensions;

-------------------------------------------------------------------------------
-- Shared helpers
-------------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-------------------------------------------------------------------------------
-- Clients and PIN access
-------------------------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  pin text,
  pin_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

comment on column public.clients.pin is
  'Write only. Type a plaintext PIN (8+ characters) here in the table editor. A trigger hashes it into pin_hash and clears this column, so plaintext is never stored.';
comment on column public.clients.pin_hash is
  'bcrypt hash of the client PIN. Never edit by hand.';

-- Hashes a newly written PIN and clears the plaintext. Rejects short PINs and
-- PINs already used by another active client.
create or replace function public.clients_hash_pin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pin is null then
    -- Nothing written to the pin column: keep the existing hash untouched.
    return new;
  end if;

  if char_length(new.pin) < 8 then
    raise exception 'PIN must be at least 8 characters long'
      using errcode = 'check_violation';
  end if;

  if char_length(new.pin) > 128 then
    raise exception 'PIN must be at most 128 characters long'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1
    from public.clients c
    where c.is_active
      and c.id <> new.id
      and c.pin_hash is not null
      and extensions.crypt(new.pin, c.pin_hash) = c.pin_hash
  ) then
    raise exception 'That PIN is already used by another active client. Choose a different PIN.'
      using errcode = 'unique_violation';
  end if;

  new.pin_hash := extensions.crypt(new.pin, extensions.gen_salt('bf', 10));
  new.pin := null;
  return new;
end;
$$;

drop trigger if exists clients_hash_pin on public.clients;
create trigger clients_hash_pin
  before insert or update of pin on public.clients
  for each row execute function public.clients_hash_pin();

-- Returns the matching active client, or no rows. Service role only.
create or replace function public.verify_client_pin(p_pin text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_pin is null or char_length(p_pin) < 8 or char_length(p_pin) > 128 then
    return;
  end if;

  return query
    select c.id, c.name
    from public.clients c
    where c.is_active
      and c.pin_hash is not null
      and extensions.crypt(p_pin, c.pin_hash) = c.pin_hash
    limit 1;
end;
$$;

revoke all on function public.clients_hash_pin() from public, anon, authenticated;
revoke all on function public.verify_client_pin(text) from public, anon, authenticated;
grant execute on function public.verify_client_pin(text) to service_role;

create table if not exists public.client_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text,
  ip text
);

create index if not exists client_sessions_client_idx on public.client_sessions (client_id);
create index if not exists client_sessions_expires_idx on public.client_sessions (expires_at);

create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null
);

create index if not exists login_attempts_ip_time_idx
  on public.login_attempts (ip, attempted_at desc);

-------------------------------------------------------------------------------
-- Instagram accounts
-------------------------------------------------------------------------------

create table if not exists public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  -- Professional account ID. This is entry.id in webhooks.
  ig_user_id text not null unique,
  -- App scoped ID from /me (id field). Used to match deauthorize and data
  -- deletion callbacks, which may identify the user by either ID.
  ig_scoped_id text,
  username text not null,
  profile_picture_url text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  token_refreshed_at timestamptz,
  connected_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  updated_at timestamptz not null default now()
);

create index if not exists instagram_accounts_scoped_idx
  on public.instagram_accounts (ig_scoped_id);

drop trigger if exists instagram_accounts_updated_at on public.instagram_accounts;
create trigger instagram_accounts_updated_at
  before update on public.instagram_accounts
  for each row execute function public.set_updated_at();

-------------------------------------------------------------------------------
-- Automations
-------------------------------------------------------------------------------

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  is_active boolean not null default false,
  media_id text not null,
  media_type text,
  media_thumbnail_url text,
  media_permalink text,
  media_caption text,
  trigger_type text not null check (trigger_type in ('any_comment', 'keywords')),
  keywords text[] not null default '{}',
  public_reply_enabled boolean not null default false,
  public_replies text[] not null default '{}',
  dm_message text not null check (char_length(dm_message) between 1 and 1000),
  dm_link_url text,
  dm_link_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automations_keywords_present
    check (trigger_type <> 'keywords' or cardinality(keywords) between 1 and 20),
  constraint automations_replies_present
    check (not public_reply_enabled or cardinality(public_replies) between 1 and 5)
);

create index if not exists automations_client_idx on public.automations (client_id);
create index if not exists automations_active_media_idx
  on public.automations (media_id) where is_active;

drop trigger if exists automations_updated_at on public.automations;
create trigger automations_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

-- Creates or updates an automation atomically. When the result is active it
-- takes a per media lock and refuses to save if another active automation on
-- the same media has an overlapping trigger. Raises TRIGGER_OVERLAP or
-- NOT_FOUND. Service role only; the server passes a validated payload.
create or replace function public.save_automation(
  p_client_id uuid,
  p_automation_id uuid,
  p_payload jsonb
)
returns setof public.automations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media_id text := p_payload->>'media_id';
  v_active boolean := coalesce((p_payload->>'is_active')::boolean, false);
  v_trigger text := p_payload->>'trigger_type';
  v_keywords text[] := coalesce(
    array(select jsonb_array_elements_text(p_payload->'keywords')), '{}'
  );
  v_replies text[] := coalesce(
    array(select jsonb_array_elements_text(p_payload->'public_replies')), '{}'
  );
  v_row public.automations;
begin
  if v_active then
    perform pg_advisory_xact_lock(hashtextextended('automation-media:' || v_media_id, 0));

    if exists (
      select 1
      from public.automations a
      where a.media_id = v_media_id
        and a.is_active
        and (p_automation_id is null or a.id <> p_automation_id)
        and (
          a.trigger_type = 'any_comment'
          or v_trigger = 'any_comment'
          or exists (
            select 1
            from unnest(a.keywords) k1
            join unnest(v_keywords) k2 on lower(k1) = lower(k2)
          )
        )
    ) then
      raise exception 'TRIGGER_OVERLAP' using errcode = 'P0001';
    end if;
  end if;

  if p_automation_id is null then
    insert into public.automations (
      client_id, instagram_account_id, name, is_active, media_id, media_type,
      media_thumbnail_url, media_permalink, media_caption, trigger_type,
      keywords, public_reply_enabled, public_replies, dm_message,
      dm_link_url, dm_link_label
    ) values (
      p_client_id,
      (p_payload->>'instagram_account_id')::uuid,
      p_payload->>'name',
      v_active,
      v_media_id,
      p_payload->>'media_type',
      p_payload->>'media_thumbnail_url',
      p_payload->>'media_permalink',
      p_payload->>'media_caption',
      v_trigger,
      v_keywords,
      coalesce((p_payload->>'public_reply_enabled')::boolean, false),
      v_replies,
      p_payload->>'dm_message',
      nullif(p_payload->>'dm_link_url', ''),
      nullif(p_payload->>'dm_link_label', '')
    )
    returning * into v_row;
  else
    update public.automations set
      instagram_account_id = (p_payload->>'instagram_account_id')::uuid,
      name = p_payload->>'name',
      is_active = v_active,
      media_id = v_media_id,
      media_type = p_payload->>'media_type',
      media_thumbnail_url = p_payload->>'media_thumbnail_url',
      media_permalink = p_payload->>'media_permalink',
      media_caption = p_payload->>'media_caption',
      trigger_type = v_trigger,
      keywords = v_keywords,
      public_reply_enabled = coalesce((p_payload->>'public_reply_enabled')::boolean, false),
      public_replies = v_replies,
      dm_message = p_payload->>'dm_message',
      dm_link_url = nullif(p_payload->>'dm_link_url', ''),
      dm_link_label = nullif(p_payload->>'dm_link_label', '')
    where id = p_automation_id
      and client_id = p_client_id
    returning * into v_row;

    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  return next v_row;
end;
$$;

revoke all on function public.save_automation(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_automation(uuid, uuid, jsonb) to service_role;

-------------------------------------------------------------------------------
-- Comment events: the processing queue and the audit log
-------------------------------------------------------------------------------

create table if not exists public.comment_events (
  id uuid primary key default gen_random_uuid(),
  comment_id text not null unique,
  automation_id uuid references public.automations(id) on delete set null,
  client_id uuid references public.clients(id) on delete cascade,
  ig_user_id text not null,
  media_id text,
  commenter_id text,
  commenter_username text,
  comment_text text,
  received_at timestamptz not null default now(),
  status text not null default 'received'
    check (status in ('received', 'no_match', 'processing', 'replied', 'dm_sent', 'failed', 'skipped')),
  public_reply_status text check (public_reply_status in ('sent', 'failed', 'skipped')),
  dm_status text check (dm_status in ('sent', 'failed', 'skipped')),
  error text,
  attempts integer not null default 0,
  -- False when a failure can never succeed on retry (for example a closed
  -- reply window), so the retry job leaves it alone.
  retryable boolean not null default true,
  last_attempt_at timestamptz,
  processed_at timestamptz
);

create index if not exists comment_events_status_idx
  on public.comment_events (status, received_at);
create index if not exists comment_events_automation_idx
  on public.comment_events (automation_id, received_at desc);
create index if not exists comment_events_client_idx
  on public.comment_events (client_id, received_at desc);
create index if not exists comment_events_ig_user_idx
  on public.comment_events (ig_user_id);

-- Atomically claims an event for processing. Returns the claimed row, or no
-- rows when another worker has it or it is not eligible. A row stuck in
-- processing for 10 minutes (a crashed worker) can be reclaimed.
create or replace function public.claim_comment_event(p_event_id uuid)
returns setof public.comment_events
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    update public.comment_events e
    set status = 'processing',
        attempts = e.attempts + 1,
        last_attempt_at = now()
    where e.id = p_event_id
      and e.attempts < 3
      and (
        e.status = 'received'
        or (e.status = 'failed' and e.retryable)
        or (e.status = 'processing' and e.last_attempt_at < now() - interval '10 minutes')
      )
    returning e.*;
end;
$$;

revoke all on function public.claim_comment_event(uuid) from public, anon, authenticated;
grant execute on function public.claim_comment_event(uuid) to service_role;

-- Per automation counts for the last 30 days, scoped to one client.
create or replace function public.automation_stats(p_client_id uuid)
returns table (automation_id uuid, matched bigint, dms_sent bigint, failures bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.automation_id,
    count(*) as matched,
    count(*) filter (where e.dm_status = 'sent') as dms_sent,
    count(*) filter (where e.status = 'failed') as failures
  from public.comment_events e
  where e.client_id = p_client_id
    and e.automation_id is not null
    and e.received_at > now() - interval '30 days'
  group by e.automation_id;
$$;

revoke all on function public.automation_stats(uuid) from public, anon, authenticated;
grant execute on function public.automation_stats(uuid) to service_role;

-------------------------------------------------------------------------------
-- Meta data deletion requests
-------------------------------------------------------------------------------

create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  meta_user_id text not null,
  status text not null default 'completed' check (status in ('completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

-------------------------------------------------------------------------------
-- Lock everything down
-------------------------------------------------------------------------------

alter table public.clients enable row level security;
alter table public.client_sessions enable row level security;
alter table public.login_attempts enable row level security;
alter table public.instagram_accounts enable row level security;
alter table public.automations enable row level security;
alter table public.comment_events enable row level security;
alter table public.data_deletion_requests enable row level security;

revoke all on table public.clients from anon, authenticated;
revoke all on table public.client_sessions from anon, authenticated;
revoke all on table public.login_attempts from anon, authenticated;
revoke all on table public.instagram_accounts from anon, authenticated;
revoke all on table public.automations from anon, authenticated;
revoke all on table public.comment_events from anon, authenticated;
revoke all on table public.data_deletion_requests from anon, authenticated;
