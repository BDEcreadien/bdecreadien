-- Migration 034 — Sépare les événements finances des événements publics
-- =====================================================================
-- Un event créé dans /admin?page=finances est un poste budgétaire (recette/dépense),
-- pas un événement public. Il ne doit pas apparaître sur l'accueil, la page /event,
-- ni dans le planning bureau.

alter table public.evenements
  add column if not exists finance_only boolean not null default false;

-- Index optionnel pour accélérer le filtre côté public
create index if not exists evenements_finance_only_idx on public.evenements(finance_only);
