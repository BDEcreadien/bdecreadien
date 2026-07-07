-- Migration 006 — Phase 2 profil étudiant
-- + statut 'sold' sur annonces
-- + motif_refus pour annonces refusées
-- + toggles notifs email/push sur profils

alter table public.annonces drop constraint if exists annonces_statut_check;
alter table public.annonces add constraint annonces_statut_check
  check (statut in ('pending','published','rejected','sold'));

alter table public.annonces add column if not exists motif_refus text;
alter table public.profils add column if not exists email_bde_enabled bool default true;
alter table public.profils add column if not exists notif_push bool default true;
