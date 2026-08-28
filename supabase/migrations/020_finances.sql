-- Migration 020 — Suivi financier BDE (version simplifiée, sans dépendance evenements)

-- 1. Colonne "bureau" sur profils
alter table public.profils
  add column if not exists bureau boolean not null default false;

comment on column public.profils.bureau is
  'Si true (en combinaison avec role in [membre,admin]), accès aux fonctions financières';

-- 2. Table des transactions financières
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null default current_date,
  libelle       text not null,
  categorie     text not null check (categorie in (
    'soiree', 'repas', 'sortie', 'cotisation', 'sponsoring',
    'virement_sumup', 'depense_course', 'materiel', 'autre'
  )),
  montant       numeric(10,2) not null,
  notes         text,
  evenement_id  uuid,
  created_by    uuid references public.profils(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_transactions_date on public.transactions (date desc);
create index if not exists idx_transactions_categorie on public.transactions (categorie);

alter table public.transactions enable row level security;

drop policy if exists "transactions_bureau_only" on public.transactions;
create policy "transactions_bureau_only" on public.transactions
  for all to authenticated
  using (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  )
  with check (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

drop trigger if exists trg_touch_transactions on public.transactions;
create trigger trg_touch_transactions
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- 3. Backup hebdo étendu à transactions
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

  delete from public.backups_hebdo where date_snap < v_now_ts - interval '3 months';

  return 'Backup effectué le ' || to_char(v_now_ts, 'YYYY-MM-DD HH24:MI');
end;
$$;
