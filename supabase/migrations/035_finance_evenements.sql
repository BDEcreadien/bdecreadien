-- Migration 035 — Table séparée pour les événements de la page finances
-- =====================================================================
-- Isole totalement les events budgétaires des events publics.
-- Plus de flag partagé sur la table `evenements` : c'est physiquement
-- deux tables différentes, impossible de mélanger.

create table if not exists public.finance_evenements (
  id                    uuid primary key default gen_random_uuid(),
  titre                 text not null,
  date                  date,
  lieu                  text,
  categorie_budget      text,
  description           text,
  gains_previsionnel    numeric(10,2),
  budget_previsionnel   numeric(10,2),
  gains_reel            numeric(10,2),
  cout_reel             numeric(10,2),
  valide                boolean not null default false,
  created_by            uuid references public.profils(id),
  created_at            timestamptz default now()
);

alter table public.finance_evenements enable row level security;

drop policy if exists "fin_ev_bureau_read" on public.finance_evenements;
create policy "fin_ev_bureau_read" on public.finance_evenements for select
  using (
    mon_role() = 'admin'
    or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
  );

drop policy if exists "fin_ev_bureau_write" on public.finance_evenements;
create policy "fin_ev_bureau_write" on public.finance_evenements for all
  using (
    mon_role() = 'admin'
    or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
  )
  with check (
    mon_role() = 'admin'
    or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
  );

-- Migre les events déjà marqués finance_only=true depuis l'ancienne table
insert into public.finance_evenements
  (titre, date, lieu, categorie_budget, description,
   gains_previsionnel, budget_previsionnel, gains_reel, cout_reel, valide,
   created_by, created_at)
select
  titre, date, lieu, categorie_budget, description,
  gains_previsionnel, budget_previsionnel, gains_reel, cout_reel, coalesce(valide, false),
  created_by, coalesce(created_at, now())
from public.evenements
where finance_only = true;

-- Retire ces events de la table publique
delete from public.evenements where finance_only = true;
