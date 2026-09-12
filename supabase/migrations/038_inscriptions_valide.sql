-- Migration 038 — Validation des inscriptions aux tâches d'événement
-- =====================================================================
-- Quand un membre s'inscrit à une tâche (bar, vestiaire...) via /admin?page=planning,
-- l'inscription apparaît en gris dans son "Mon planning". Une fois validée par le
-- bureau, elle prend sa couleur normale.

alter table public.inscriptions_taches
  add column if not exists valide boolean not null default false;

alter table public.inscriptions_taches
  add column if not exists valide_par uuid references public.profils(id) on delete set null;

alter table public.inscriptions_taches
  add column if not exists valide_at timestamptz;
