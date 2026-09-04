-- Migration 029 — Badge "nouveau planning" pour /mon-espace
-- Stocke la dernière visite de l'onglet Organisation events par membre BDE.
-- Comparée à evenements.created_at pour afficher un badge sur les events non-vus.

alter table public.profils
  add column if not exists last_planning_view timestamptz;

comment on column public.profils.last_planning_view is
  'Timestamp de la dernière visite de l''onglet Organisation events. Utilisé pour badge "nouveau planning".';
