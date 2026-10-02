-- Migration 054 — Designs inline par produit (JSONB)
-- Remplace le système boutique_designs + boutique_produit_designs par
-- une colonne designs directement sur boutique_produits.
-- Format : [{"nom": "Design 1", "image_url": "https://..."}, ...]

ALTER TABLE public.boutique_produits
  ADD COLUMN IF NOT EXISTS designs JSONB DEFAULT '[]'::jsonb;
