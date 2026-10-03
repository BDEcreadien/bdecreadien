-- Migration 055 — Galerie d'images par produit
-- Format : [{"url": "https://..."}, ...]

ALTER TABLE public.boutique_produits
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
