-- Migration 018 — Migration des événements JSON → table Supabase
-- Permet d'éditer les événements sans passer par GitHub API

create table if not exists public.evenements (
  id                uuid primary key default gen_random_uuid(),
  titre             text not null,
  date              date,
  date_affichage    text,
  horaire           text,
  horaire_debut     text,
  horaire_fin       text,
  lieu              text,
  adresse           text,
  description       text,
  prix              text,
  categorie         text,
  image_url         text,
  lien              text,
  type_lien         text,
  phare             boolean not null default false,
  inscrits          int not null default 0,
  ordre             int not null default 0,
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.profils(id) on delete set null
);

create index if not exists idx_evenements_date on public.evenements (date desc);
create index if not exists idx_evenements_phare on public.evenements (phare);
create index if not exists idx_evenements_archived on public.evenements (archived);

alter table public.evenements enable row level security;

-- SELECT public (tout le monde peut lire les événements)
drop policy if exists "evenements_select_public" on public.evenements;
create policy "evenements_select_public" on public.evenements
  for select using (true);

-- INSERT/UPDATE/DELETE : membre BDE + admin
drop policy if exists "evenements_write_bde" on public.evenements;
create policy "evenements_write_bde" on public.evenements
  for all to authenticated
  using (public.mon_role() in ('membre', 'admin'))
  with check (public.mon_role() in ('membre', 'admin'));

-- Trigger updated_at
drop trigger if exists trg_touch_evenements on public.evenements;
create trigger trg_touch_evenements
  before update on public.evenements
  for each row execute function public.touch_updated_at();

-- Table des inscriptions déjà existante (003) — on garde
-- inscriptions_evenements.evenement_slug référencera plus tard evenements.id (via un slug ou l'id)
