-- Migration 025 — Page Liens (Linktree maison)

create table if not exists public.liens (
  id            uuid primary key default gen_random_uuid(),
  titre         text not null check (char_length(titre) between 1 and 80),
  url           text not null check (char_length(url) between 3 and 1000),
  icone         text check (icone is null or char_length(icone) <= 8),
  ordre         int not null default 0,
  actif         boolean not null default true,
  created_by    uuid references public.profils(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_liens_ordre on public.liens (ordre) where actif = true;

alter table public.liens enable row level security;

-- SELECT public : uniquement les liens actifs, tout le monde peut lire
drop policy if exists "liens_select_public" on public.liens;
create policy "liens_select_public" on public.liens
  for select using (actif = true);

-- SELECT bureau : voir aussi les liens inactifs pour la gestion admin
drop policy if exists "liens_select_bureau" on public.liens;
create policy "liens_select_bureau" on public.liens
  for select to authenticated
  using (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

-- INSERT/UPDATE/DELETE bureau uniquement
drop policy if exists "liens_write_bureau" on public.liens;
create policy "liens_write_bureau" on public.liens
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
drop trigger if exists trg_touch_liens on public.liens;
create trigger trg_touch_liens
  before update on public.liens
  for each row execute function public.touch_updated_at();

-- Extend backup hebdo
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

  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'dispos_bureau', jsonb_agg(row_to_json(t)), count(*) from public.dispos_bureau t;

  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'liens', jsonb_agg(row_to_json(t)), count(*) from public.liens t;

  delete from public.backups_hebdo where date_snap < v_now_ts - interval '3 months';

  return 'Backup effectué le ' || to_char(v_now_ts, 'YYYY-MM-DD HH24:MI');
end;
$$;
