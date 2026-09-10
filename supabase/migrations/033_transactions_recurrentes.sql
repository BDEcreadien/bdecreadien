-- Migration 033 — Transactions récurrentes (débits/crédits automatiques mensuels)
-- =============================================================================
-- Permet de définir une transaction qui se répète chaque mois (loyer, cotisation,
-- assurance, subvention mensuelle...). Elles sont dépliées à la volée côté frontend
-- pour peupler la liste, les tuiles, la courbe et le PDF.

create table if not exists public.transactions_recurrentes (
  id           uuid primary key default gen_random_uuid(),
  libelle      text not null,
  categorie    text not null,
  montant      numeric(10,2) not null,  -- signé : positif = recette, négatif = dépense
  jour_du_mois int  not null default 1 check (jour_du_mois between 1 and 28),
  date_debut   date not null,
  date_fin     date,                    -- null = indéfini
  notes        text,
  created_by   uuid references public.profils(id),
  created_at   timestamptz default now()
);

alter table public.transactions_recurrentes enable row level security;

drop policy if exists "recur_bureau_read" on public.transactions_recurrentes;
create policy "recur_bureau_read" on public.transactions_recurrentes for select
  using (
    mon_role() = 'admin'
    or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
  );

drop policy if exists "recur_bureau_write" on public.transactions_recurrentes;
create policy "recur_bureau_write" on public.transactions_recurrentes for all
  using (
    mon_role() = 'admin'
    or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
  )
  with check (
    mon_role() = 'admin'
    or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
  );
