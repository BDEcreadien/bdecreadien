-- Migration 022 — Table evenements pour le prévisionnel finances
-- Autonome (pas de dépendance à la migration 018)

create table if not exists public.evenements (
  id                    uuid primary key default gen_random_uuid(),
  titre                 text not null,
  date                  date,
  lieu                  text,
  description           text,
  categorie_budget      text,
  budget_previsionnel   numeric(10,2),
  cout_reel             numeric(10,2),
  created_by            uuid references public.profils(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_evenements_date on public.evenements (date);

alter table public.evenements enable row level security;

-- SELECT public (pour l'agenda public futur)
drop policy if exists "evenements_select_public" on public.evenements;
create policy "evenements_select_public" on public.evenements
  for select using (true);

-- INSERT/UPDATE/DELETE : bureau uniquement
drop policy if exists "evenements_write_bureau" on public.evenements;
create policy "evenements_write_bureau" on public.evenements
  for all to authenticated
  using (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  )
  with check (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

-- Trigger updated_at
drop trigger if exists trg_touch_evenements on public.evenements;
create trigger trg_touch_evenements
  before update on public.evenements
  for each row execute function public.touch_updated_at();

-- RPC : moyenne des coûts réels par catégorie (pour l'auto-estimation prévisionnelle)
create or replace function public.moyenne_cout_categorie(p_categorie text, p_limit int default 5)
returns numeric
language sql
security definer
set search_path = public
as $$
  select round(avg(cout_reel)::numeric, 2)
  from (
    select cout_reel from public.evenements
    where categorie_budget = p_categorie and cout_reel is not null
    order by date desc nulls last, created_at desc
    limit p_limit
  ) t;
$$;

revoke execute on function public.moyenne_cout_categorie(text, int) from public;
grant execute on function public.moyenne_cout_categorie(text, int) to authenticated;

-- Backup hebdo étendu à evenements
create or replace function public.faire_backup_hebdo()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_ts timestamptz := now();
begin
  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'profils', jsonb_agg(row_to_json(t)), count(*) from public.profils t;

  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'annonces', jsonb_agg(row_to_json(t)), count(*) from public.annonces t;

  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'cartes_fidelite', jsonb_agg(row_to_json(t)), count(*) from public.cartes_fidelite t;

  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'newsletter_subscribers', jsonb_agg(row_to_json(t)), count(*) from public.newsletter_subscribers t;

  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'demandes_membre_bde', jsonb_agg(row_to_json(t)), count(*) from public.demandes_membre_bde t;

  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'feedbacks', jsonb_agg(row_to_json(t)), count(*) from public.feedbacks t;

  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'transactions', jsonb_agg(row_to_json(t)), count(*) from public.transactions t;

  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'evenements', jsonb_agg(row_to_json(t)), count(*) from public.evenements t;

  delete from public.backups_hebdo where date_snap < v_now_ts - interval '3 months';

  return 'Backup effectué le ' || to_char(v_now_ts, 'YYYY-MM-DD HH24:MI');
end;
$$;
