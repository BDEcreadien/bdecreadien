-- ============================================
-- Migration 004 — Demandes d'adhésion BDE
--                 + Ouverture policies membre BDE
-- ============================================

-- Table des demandes d'adhésion au BDE
create table if not exists public.demandes_membre_bde (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profils(id) on delete cascade not null unique,
  motivation  text not null,
  statut      text not null default 'pending' check (statut in ('pending','accepted','rejected')),
  traite_par  uuid references public.profils(id),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists demandes_statut_idx on public.demandes_membre_bde(statut);

alter table public.demandes_membre_bde enable row level security;

create policy "demandes_select" on public.demandes_membre_bde for select
  using (user_id = auth.uid() or mon_role() = 'admin');

create policy "demandes_insert_own" on public.demandes_membre_bde for insert
  with check (user_id = auth.uid() and mon_role() = 'etudiant');

create policy "demandes_update_admin" on public.demandes_membre_bde for update
  using (mon_role() = 'admin');

create policy "demandes_delete_own" on public.demandes_membre_bde for delete
  using (user_id = auth.uid() and statut = 'pending');

-- ============================================
-- Ouvrir modération annonces aux membres BDE
-- ============================================
drop policy if exists "annonces_select_published" on public.annonces;
create policy "annonces_select_published" on public.annonces for select
  using (statut = 'published' or auteur_id = auth.uid() or mon_role() in ('membre','admin'));

drop policy if exists "annonces_update" on public.annonces;
create policy "annonces_update" on public.annonces for update
  using ((auteur_id = auth.uid() and statut = 'pending') or mon_role() in ('membre','admin'));

drop policy if exists "annonces_delete" on public.annonces;
create policy "annonces_delete" on public.annonces for delete
  using (auteur_id = auth.uid() or mon_role() in ('membre','admin'));

-- ============================================
-- Ouvrir lecture feedbacks aux membres BDE
-- ============================================
drop policy if exists "fb_select" on public.feedbacks;
create policy "fb_select" on public.feedbacks for select
  using (auteur_id = auth.uid() or mon_role() in ('membre','admin'));

drop policy if exists "fb_update_admin" on public.feedbacks;
create policy "fb_update_bde" on public.feedbacks for update
  using (mon_role() in ('membre','admin'));

-- ============================================
-- Ouvrir lecture inscriptions aux membres BDE
-- ============================================
drop policy if exists "insc_select" on public.inscriptions_evenements;
create policy "insc_select" on public.inscriptions_evenements for select
  using (user_id = auth.uid() or mon_role() in ('membre','admin'));

-- ============================================
-- Storage annonces : autoriser membres BDE à supprimer
-- ============================================
drop policy if exists "annonces_delete_own" on storage.objects;
create policy "annonces_delete_bde" on storage.objects for delete to authenticated
  using (bucket_id = 'annonces' and (owner = auth.uid() or mon_role() in ('membre','admin')));

-- ============================================
-- Admin peut modifier n'importe quel profil (pour changer les rôles)
-- ============================================
drop policy if exists "profils_update_own" on public.profils;
create policy "profils_update_own_or_admin" on public.profils for update
  using (id = auth.uid() or mon_role() = 'admin');
