-- Migration 043 — Retire la contrainte figée sur categorie dans annonces
-- ============================================================================
-- La liste des catégories est gérée dynamiquement via _data/annonces-categories.json
-- côté admin. La contrainte CHECK Postgres bloquait toute nouvelle catégorie
-- (ex: "stage--alternance", "places", "autres") → 400 à la publication.

alter table public.annonces drop constraint if exists annonces_categorie_check;

-- description : ne plus être obligatoire (le titre + photo suffisent souvent)
alter table public.annonces alter column description drop not null;
