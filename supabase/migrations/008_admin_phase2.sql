-- Migration 008 — Phase 2 Admin
-- + Historique des modérations sur annonces
-- + Bannissement utilisateur

alter table public.annonces add column if not exists modere_par uuid references public.profils(id);
alter table public.annonces add column if not exists modere_at timestamptz;
alter table public.profils add column if not exists banni_jusqu_a timestamptz;
