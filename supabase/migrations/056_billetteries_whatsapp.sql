-- Migration 056 — Champ whatsapp_url sur la table billetteries
-- Permet d'associer un lien de groupe WhatsApp à chaque billetterie,
-- inclus dans l'email de confirmation de paiement.

alter table public.billetteries
  add column if not exists whatsapp_url text;

comment on column public.billetteries.whatsapp_url is
  'Lien d''invitation au groupe WhatsApp envoyé dans l''email de confirmation (optionnel).';
