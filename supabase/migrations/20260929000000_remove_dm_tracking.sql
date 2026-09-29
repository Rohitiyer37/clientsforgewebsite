-- Removes DM tracking from Content Analytics. No DM data is sourced or kept:
-- the conversation metadata table, its functions, and the DM tracking state
-- are dropped. comment_events.dm_sent_at stays as the automation's own audit
-- of when its private reply went out; it is not DM sourcing.

drop function if exists public.record_inbound_dm(uuid, text, timestamptz);
drop function if exists public.reconcile_dm_attribution(uuid);
drop function if exists public.ig_new_dm_daily(uuid, timestamptz, timestamptz, text);

drop table if exists public.ig_conversations;

alter table public.ig_analytics_state
  drop column if exists dm_tracking_started_at,
  drop column if exists dm_backfill_cursor,
  drop column if exists dm_backfill_completed_at;

drop index if exists public.comment_events_commenter_dm_idx;
comment on column public.comment_events.dm_sent_at is
  'When the automation''s private reply DM was sent. Audit only.';

create or replace function public.reset_ig_analytics(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.ig_account_daily_metrics where instagram_account_id = p_account_id;
  delete from public.ig_media where instagram_account_id = p_account_id;
  delete from public.ig_sync_runs where instagram_account_id = p_account_id;
  delete from public.ig_analytics_state where instagram_account_id = p_account_id;
end;
$$;

revoke all on function public.reset_ig_analytics(uuid) from public, anon, authenticated;
grant execute on function public.reset_ig_analytics(uuid) to service_role;

-- Bio link taps come from website_clicks, and profile visits from
-- profile_views. Both are still served by the API (verified 29 Sep 2026).
comment on column public.ig_account_daily_metrics.bio_link_taps is
  'Instagram website_clicks: taps on the link in the bio.';
comment on column public.ig_account_daily_metrics.profile_visits is
  'Instagram profile_views: times the profile was visited.';
