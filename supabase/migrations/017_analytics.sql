-- Migration 017 — Analytics maison (pageviews + clicks)
-- Léger, RGPD-friendly (aucune donnée perso, session_id anonyme)

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null default 'pageview' check (event_type in ('pageview', 'click')),
  path        text not null,
  session_id  text not null,
  referer     text,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_analytics_created_at on public.analytics_events (created_at desc);
create index if not exists idx_analytics_session on public.analytics_events (session_id);

alter table public.analytics_events enable row level security;

-- INSERT public (tracking anonyme) avec validation
drop policy if exists "analytics_insert_public" on public.analytics_events;
create policy "analytics_insert_public" on public.analytics_events
  for insert to anon, authenticated
  with check (
    length(path) <= 500
    and length(session_id) between 8 and 64
    and (referer is null or length(referer) <= 500)
    and (label is null or length(label) <= 200)
  );

-- SELECT/DELETE réservés aux membres BDE / admins
drop policy if exists "analytics_read_bde" on public.analytics_events;
create policy "analytics_read_bde" on public.analytics_events
  for select to authenticated
  using (public.mon_role() in ('membre', 'admin'));

drop policy if exists "analytics_delete_admin" on public.analytics_events;
create policy "analytics_delete_admin" on public.analytics_events
  for delete to authenticated
  using (public.mon_role() = 'admin');

-- RPC agrégée pour le dashboard trafic
create or replace function public.analytics_stats(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  since timestamptz := now() - (p_days || ' days')::interval;
begin
  if public.mon_role() not in ('membre', 'admin') then
    raise exception 'Accès refusé';
  end if;

  select jsonb_build_object(
    'range_days', p_days,
    'pageviews_total', (
      select count(*) from public.analytics_events
      where event_type = 'pageview' and created_at >= since
    ),
    'unique_visitors', (
      select count(distinct session_id) from public.analytics_events
      where created_at >= since
    ),
    'clicks_total', (
      select count(*) from public.analytics_events
      where event_type = 'click' and created_at >= since
    ),
    'avg_session_pages', (
      select coalesce(round(avg(nb)::numeric, 1), 0)
      from (
        select count(*) as nb from public.analytics_events
        where event_type = 'pageview' and created_at >= since
        group by session_id
      ) t
    ),
    'avg_session_seconds', (
      select coalesce(round(avg(dur)::numeric, 0), 0)
      from (
        select extract(epoch from (max(created_at) - min(created_at))) as dur
        from public.analytics_events
        where created_at >= since
        group by session_id
        having count(*) > 1
      ) t
    ),
    'top_pages', (
      select coalesce(jsonb_agg(row_to_json(t) order by nb desc), '[]'::jsonb)
      from (
        select path, count(*) as nb
        from public.analytics_events
        where event_type = 'pageview' and created_at >= since
        group by path
        order by nb desc
        limit 10
      ) t
    ),
    'top_clicks', (
      select coalesce(jsonb_agg(row_to_json(t) order by nb desc), '[]'::jsonb)
      from (
        select label, count(*) as nb
        from public.analytics_events
        where event_type = 'click' and label is not null and created_at >= since
        group by label
        order by nb desc
        limit 10
      ) t
    ),
    'daily_visitors', (
      select coalesce(jsonb_agg(row_to_json(t) order by day asc), '[]'::jsonb)
      from (
        select
          to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
          count(distinct session_id) as visitors,
          count(*) filter (where event_type = 'pageview') as pageviews
        from public.analytics_events
        where created_at >= since
        group by 1
        order by 1
      ) t
    )
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.analytics_stats(int) from public;
grant execute on function public.analytics_stats(int) to authenticated;

-- Reset : purge complète (admin only)
create or replace function public.analytics_reset()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if public.mon_role() <> 'admin' then
    raise exception 'Réservé aux admins';
  end if;
  delete from public.analytics_events;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.analytics_reset() from public;
grant execute on function public.analytics_reset() to authenticated;
