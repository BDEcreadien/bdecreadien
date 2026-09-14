-- Migration 044 — Champ "fournisseur" sur transactions
-- ============================================================================
-- Permet de renseigner le magasin ou la personne chez qui l'achat/la vente a été faite
-- Ex: "Carrefour Cordeliers", "Julien Persiani", "Ninkasi bar"

alter table public.transactions
  add column if not exists fournisseur text;

comment on column public.transactions.fournisseur is
  'Nom du magasin, fournisseur ou personne concernée par la transaction (facultatif)';
