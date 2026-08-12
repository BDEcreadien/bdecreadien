-- ============================================
-- Migration 010 — Cartes fidélité dans Supabase
-- ============================================
-- Auto-création d'une carte à l'inscription, accessible depuis mon-espace

create table if not exists public.cartes_fidelite (
  user_id     uuid primary key references public.profils(id) on delete cascade,
  tampons     int not null default 0 check (tampons >= 0),
  total       int not null default 10 check (total > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.cartes_fidelite enable row level security;

-- Chaque étudiant peut lire sa propre carte
drop policy if exists "cartes_select_own" on public.cartes_fidelite;
create policy "cartes_select_own" on public.cartes_fidelite for select
  using (user_id = auth.uid() or mon_role() in ('membre','admin'));

-- Seuls les membres BDE / admins peuvent modifier les tampons
drop policy if exists "cartes_update_bde" on public.cartes_fidelite;
create policy "cartes_update_bde" on public.cartes_fidelite for update
  using (mon_role() in ('membre','admin'))
  with check (mon_role() in ('membre','admin'));

-- Insert : ouvert à tout utilisateur authentifié pour sa propre carte
drop policy if exists "cartes_insert_own" on public.cartes_fidelite;
create policy "cartes_insert_own" on public.cartes_fidelite for insert to authenticated
  with check (user_id = auth.uid());

-- Trigger : auto-création d'une carte quand un nouveau profil est créé
create or replace function public.create_carte_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cartes_fidelite (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_carte on public.profils;
create trigger trg_create_carte
  after insert on public.profils
  for each row execute function public.create_carte_on_signup();

-- Backfill : créer une carte pour tous les profils existants qui n'en ont pas
insert into public.cartes_fidelite (user_id)
select id from public.profils
where id not in (select user_id from public.cartes_fidelite)
on conflict (user_id) do nothing;

-- Trigger pour updated_at automatique
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_cartes on public.cartes_fidelite;
create trigger trg_touch_cartes
  before update on public.cartes_fidelite
  for each row execute function public.touch_updated_at();
