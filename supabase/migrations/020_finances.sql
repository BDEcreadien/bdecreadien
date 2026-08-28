-- Migration 020 — Suivi financier BDE (version robuste, tolère l'absence de evenements)

-- 1. Colonne "bureau" sur profils
alter table public.profils
  add column if not exists bureau boolean not null default false;

comment on column public.profils.bureau is
  'Si true (en combinaison avec role in [membre,admin]), accès aux fonctions financières';

-- 2. Colonnes budget sur evenements (uniquement si la table existe)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'evenements') then
    alter table public.evenements add column if not exists budget_previsionnel numeric(10,2);
    alter table public.evenements add column if not exists cout_reel numeric(10,2);
    alter table public.evenements add column if not exists categorie_budget text;
  end if;
end $$;

-- 3. Table des transactions financières (indépendante de evenements)
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
  evenement_id  uuid,  -- pas de FK vers evenements pour ne pas dépendre de la table
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

-- 4. Backup hebdo étendu à transactions (et resilient sans evenements)
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

-- 5. RPC moyenne_cout_categorie — retourne null si table evenements absente
create or replace function public.moyenne_cout_categorie(p_categorie text, p_limit int default 5)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moy numeric;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'evenements') then
    return null;
  end if;
  execute format('
    select round(avg(cout_reel)::numeric, 2)
    from (
      select cout_reel from public.evenements
      where categorie_budget = %L and cout_reel is not null
      order by date desc nulls last, created_at desc
      limit %s
    ) t', p_categorie, p_limit)
  into v_moy;
  return v_moy;
end;
$$;

grant execute on function public.moyenne_cout_categorie(text, int) to authenticated;
