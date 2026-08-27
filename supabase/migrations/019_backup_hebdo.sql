-- Migration 019 — Backup automatique hebdomadaire
-- Snapshot des tables critiques chaque dimanche à 3h du matin
-- Purge des snapshots > 3 mois

-- 1. Active l'extension pg_cron (si pas déjà)
create extension if not exists pg_cron;

-- 2. Table qui stocke les snapshots
create table if not exists public.backups_hebdo (
  id          uuid primary key default gen_random_uuid(),
  date_snap   timestamptz not null default now(),
  table_name  text not null,
  contenu     jsonb not null,
  nb_lignes   int not null
);

create index if not exists idx_backups_date on public.backups_hebdo (date_snap desc);

alter table public.backups_hebdo enable row level security;

-- Seuls les admins peuvent lire/exporter les backups
drop policy if exists "backups_admin_only" on public.backups_hebdo;
create policy "backups_admin_only" on public.backups_hebdo
  for all to authenticated
  using (public.mon_role() = 'admin')
  with check (public.mon_role() = 'admin');

-- 3. Fonction qui fait un snapshot de toutes les tables critiques
-- Note : les alias de tables (t) diffèrent des variables PL/pgSQL (v_now_ts) pour éviter les collisions
create or replace function public.faire_backup_hebdo()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_ts timestamptz := now();
begin
  -- Profils utilisateurs
  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'profils', jsonb_agg(row_to_json(t)), count(*)
  from public.profils t;

  -- Annonces
  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'annonces', jsonb_agg(row_to_json(t)), count(*)
  from public.annonces t;

  -- Cartes fidélité
  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'cartes_fidelite', jsonb_agg(row_to_json(t)), count(*)
  from public.cartes_fidelite t;

  -- Newsletter
  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'newsletter_subscribers', jsonb_agg(row_to_json(t)), count(*)
  from public.newsletter_subscribers t;

  -- Demandes d'adhésion
  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'demandes_membre_bde', jsonb_agg(row_to_json(t)), count(*)
  from public.demandes_membre_bde t;

  -- Feedbacks
  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'feedbacks', jsonb_agg(row_to_json(t)), count(*)
  from public.feedbacks t;

  -- Purge des snapshots > 3 mois (garde ~12 snapshots)
  delete from public.backups_hebdo where date_snap < v_now_ts - interval '3 months';

  return 'Backup effectué le ' || to_char(v_now_ts, 'YYYY-MM-DD HH24:MI');
end;
$$;

revoke execute on function public.faire_backup_hebdo() from public;
grant execute on function public.faire_backup_hebdo() to authenticated;

-- 4. Planification : chaque dimanche à 3h du matin (UTC)
-- Si le job existe déjà, on le supprime avant
select cron.unschedule('backup-hebdo') where exists (select 1 from cron.job where jobname = 'backup-hebdo');

select cron.schedule(
  'backup-hebdo',
  '0 3 * * 0',  -- 3h00 UTC chaque dimanche
  $$select public.faire_backup_hebdo()$$
);
