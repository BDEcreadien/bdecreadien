-- Migration 024 — Durcissement des inserts analytics
-- Restreint event_type aux valeurs connues + trigger de rate-limit basique par session_id

-- 1. Restreindre event_type aux valeurs autorisées + tightening des tailles
drop policy if exists "analytics_insert_public" on public.analytics_events;
create policy "analytics_insert_public" on public.analytics_events
  for insert to anon, authenticated
  with check (
    event_type in ('pageview', 'click')
    and length(path) between 1 and 500
    and length(session_id) between 8 and 64
    and (referer is null or length(referer) <= 500)
    and (label is null or length(label) <= 200)
  );

-- 2. Rate-limit par session_id : max 100 events / minute
-- (garde-fou serveur en plus du throttle client côté tracker.js)
create or replace function public.check_analytics_rate_limit()
returns trigger
language plpgsql
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.analytics_events
  where session_id = new.session_id
    and created_at > now() - interval '1 minute';
  if v_count >= 100 then
    raise exception 'Analytics rate limit exceeded for session %', new.session_id
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_analytics_rate_limit on public.analytics_events;
create trigger trg_analytics_rate_limit
  before insert on public.analytics_events
  for each row execute function public.check_analytics_rate_limit();

-- 3. Index pour que la vérification rate-limit reste rapide
create index if not exists idx_analytics_session_created
  on public.analytics_events (session_id, created_at desc);

-- 4. Cleanup helper (à appeler manuellement ou via pg_cron) : purge > 90 jours
create or replace function public.purge_analytics_older_than_90d()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.analytics_events
   where created_at < now() - interval '90 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.purge_analytics_older_than_90d() from public;
grant execute on function public.purge_analytics_older_than_90d() to authenticated;
