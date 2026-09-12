-- Migration 040 — Ajoute colonne pole sur profils (pour groupage planning)
-- ============================================================================
-- Sans cette colonne, la liste "Assigner à" dans Mon planning ne peut pas
-- grouper les membres par pôle.

alter table public.profils
  add column if not exists pole text;

create index if not exists profils_pole_idx on public.profils(pole) where pole is not null;
