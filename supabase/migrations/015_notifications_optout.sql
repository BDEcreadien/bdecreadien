-- Migration 015 — Permet à chaque membre BDE / admin de désactiver ses notifs email
alter table public.profils
  add column if not exists notifications_bde_enabled boolean not null default true;

comment on column public.profils.notifications_bde_enabled is
  'Si false, ce membre BDE / admin ne recevra pas les emails de notification (feedbacks, annonces à modérer, demandes d''adhésion).';
