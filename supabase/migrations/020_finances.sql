-- Migration 020 — Suivi financier BDE (transactions + bureau + budget events)

-- 1. Colonne "bureau" sur profils : distingue les membres du bureau (président, VP, trésorier)
alter table public.profils
  add column if not exists bureau boolean not null default false;

comment on column public.profils.bureau is
  'Si true (en combinaison avec role in [membre,admin]), accès aux fonctions financières';

-- 2. Colonnes budget sur evenements (optionnelles)
alter table public.evenements
  add column if not exists budget_previsionnel numeric(10,2),
  add column if not exists cout_reel numeric(10,2),
  add column if not exists categorie_budget text
    check (categorie_budget is null or categorie_budget in ('soiree', 'repas', 'sortie', 'materiel', 'autre'));

-- 3. Table des transactions financières
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  date          date not null default current_date,
  libelle       text not null,
  categorie     text not null check (categorie in (
    'soiree', 'repas', 'sortie', 'cotisation', 'sponsoring',
    'virement_sumup', 'depense_course', 'materiel', 'autre'
  )),
  montant       numeric(10,2) not null,  -- positif = recette, négatif = dépense
  notes         text,
  evenement_id  uuid references public.evenements(id) on delete set null,
  created_by    uuid references public.profils(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_transactions_date on public.transactions (date desc);
create index if not exists idx_transactions_categorie on public.transactions (categorie);

alter table public.transactions enable row level security;

-- RLS : seuls les admins + membres BDE marqués bureau=true peuvent accéder
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

-- Trigger updated_at
drop trigger if exists trg_touch_transactions on public.transactions;
create trigger trg_touch_transactions
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- 4. Ajoute transactions à la sauvegarde hebdomadaire
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

  -- NOUVEAU : transactions
  insert into public.backups_hebdo (date_snap, table_name, contenu, nb_lignes)
  select v_now_ts, 'transactions', jsonb_agg(row_to_json(t)), count(*) from public.transactions t;

  -- Purge > 3 mois
  delete from public.backups_hebdo where date_snap < v_now_ts - interval '3 months';

  return 'Backup effectué le ' || to_char(v_now_ts, 'YYYY-MM-DD HH24:MI');
end;
$$;

-- 5. RPC : moyenne des coûts réels par catégorie (pour l'auto-estimation)
create or replace function public.moyenne_cout_categorie(p_categorie text, p_limit int default 5)
returns numeric
language sql
security definer
set search_path = public
as $$
  select round(avg(cout_reel)::numeric, 2)
  from (
    select cout_reel from public.evenements
    where categorie_budget = p_categorie
      and cout_reel is not null
    order by date desc nulls last, created_at desc
    limit p_limit
  ) t;
$$;

grant execute on function public.moyenne_cout_categorie(text, int) to authenticated;
