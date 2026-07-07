-- ============================================
-- Migration 005 — Config BDE partagée
-- ============================================
-- Table pour stocker le token GitHub (et autres secrets BDE)
-- Lisible par membres + admins, éditable par admins uniquement.

create table if not exists public.bde_config (
  id          text primary key,
  value       text not null,
  updated_at  timestamptz default now(),
  updated_by  uuid references public.profils(id)
);

alter table public.bde_config enable row level security;

create policy "bde_config_select_bde" on public.bde_config for select
  using (mon_role() in ('membre','admin'));

create policy "bde_config_insert_admin" on public.bde_config for insert
  with check (mon_role() = 'admin');

create policy "bde_config_update_admin" on public.bde_config for update
  using (mon_role() = 'admin');
