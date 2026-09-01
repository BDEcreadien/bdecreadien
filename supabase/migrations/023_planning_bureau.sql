-- Migration 023 — Planning bureau : qui aide sur quel événement

-- 1. Flag "interne" sur evenements (pour marquer les events bureau-only : réu, montage, etc.)
alter table public.evenements
  add column if not exists interne boolean not null default false;

comment on column public.evenements.interne is
  'Si true, événement interne bureau (réunion prépa, montage) — masqué de la vue publique';

-- 2. Table des disponibilités bureau
create table if not exists public.dispos_bureau (
  id            uuid primary key default gen_random_uuid(),
  evenement_id  uuid not null references public.evenements(id) on delete cascade,
  membre_id     uuid not null references public.profils(id) on delete cascade,
  statut        text not null check (statut in ('oui', 'peut_etre', 'non')),
  role          text,
  creneau       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (evenement_id, membre_id)
);

create index if not exists idx_dispos_bureau_event on public.dispos_bureau (evenement_id);
create index if not exists idx_dispos_bureau_membre on public.dispos_bureau (membre_id);

alter table public.dispos_bureau enable row level security;

-- SELECT : tout membre du bureau voit toutes les dispos
drop policy if exists "dispos_bureau_select" on public.dispos_bureau;
create policy "dispos_bureau_select" on public.dispos_bureau
  for select to authenticated
  using (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

-- INSERT : un bureau ne peut créer QUE sa propre ligne
drop policy if exists "dispos_bureau_insert" on public.dispos_bureau;
create policy "dispos_bureau_insert" on public.dispos_bureau
  for insert to authenticated
  with check (
    membre_id = auth.uid()
    and (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

-- UPDATE : un bureau ne peut modifier QUE sa propre ligne
drop policy if exists "dispos_bureau_update" on public.dispos_bureau;
create policy "dispos_bureau_update" on public.dispos_bureau
  for update to authenticated
  using (
    membre_id = auth.uid()
    and (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  )
  with check (membre_id = auth.uid());

-- DELETE : sa propre ligne, OU admin peut nettoyer
drop policy if exists "dispos_bureau_delete" on public.dispos_bureau;
create policy "dispos_bureau_delete" on public.dispos_bureau
  for delete to authenticated
  using (
    (membre_id = auth.uid() or public.mon_role() = 'admin')
    and (select bureau from public.profils where id = auth.uid()) = true
  );

-- Trigger updated_at
drop trigger if exists trg_touch_dispos_bureau on public.dispos_bureau;
create trigger trg_touch_dispos_bureau
  before update on public.dispos_bureau
  for each row execute function public.touch_updated_at();

-- 3. Backup hebdo étendu
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

  delete from public.backups_hebdo where date_snap < v_now_ts - interval '3 months';

  return 'Backup effectué le ' || to_char(v_now_ts, 'YYYY-MM-DD HH24:MI');
end;
$$;
