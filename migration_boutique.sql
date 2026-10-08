-- ══════════════════════════════════════════════════════════
-- Migration boutique : ajout couleurs + nouveaux produits
-- À exécuter dans Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. Ajouter les colonnes couleurs aux produits
ALTER TABLE boutique_produits
  ADD COLUMN IF NOT EXISTS couleurs_disponibles jsonb DEFAULT '[]'::jsonb;

-- 2. Ajouter couleur aux items de commande
ALTER TABLE boutique_items
  ADD COLUMN IF NOT EXISTS couleur text;

-- 3. Supprimer tous les packs d'abord (FK vers boutique_produits)
DELETE FROM boutique_packs;

-- 4. Supprimer les anciens produits non voulus
DELETE FROM boutique_items
  WHERE produit_id IN (
    SELECT id FROM boutique_produits
    WHERE nom IN ('Porte-clef décapsuleur', 'Porte-clef', 'Chaussettes', 'Tasse')
  );
DELETE FROM boutique_produits
  WHERE nom IN ('Porte-clef décapsuleur', 'Porte-clef', 'Chaussettes', 'Tasse');

-- 5. Insérer les produits (tailles_disponibles est text[], designs/couleurs sont jsonb)

-- T-shirt
INSERT INTO boutique_produits (nom, prix_centimes, actif, categorie, ordre, a_tailles, tailles_disponibles, designs, couleurs_disponibles)
VALUES (
  'T-shirt', 0, true, 'vetements', 1, true,
  ARRAY['S','M','L','XL'],
  '[{"nom":"Design 1","image_url":""},{"nom":"Design 2","image_url":""},{"nom":"Design 3","image_url":""},{"nom":"Design 4","image_url":""}]'::jsonb,
  '["Blanc","Noir","Bleu","Rose","Vert"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Sweat col rond
INSERT INTO boutique_produits (nom, prix_centimes, actif, categorie, ordre, a_tailles, tailles_disponibles, designs, couleurs_disponibles)
VALUES (
  'Sweat col rond', 0, true, 'vetements', 2, true,
  ARRAY['S','M','L','XL'],
  '[{"nom":"Design 1","image_url":""},{"nom":"Design 2","image_url":""},{"nom":"Design 3","image_url":""},{"nom":"Design 4","image_url":""}]'::jsonb,
  '["Blanc","Noir","Bleu","Rose","Vert"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Sweat à capuche
INSERT INTO boutique_produits (nom, prix_centimes, actif, categorie, ordre, a_tailles, tailles_disponibles, designs, couleurs_disponibles)
VALUES (
  'Sweat à capuche', 0, true, 'vetements', 3, true,
  ARRAY['S','M','L','XL'],
  '[{"nom":"Design 1","image_url":""},{"nom":"Design 2","image_url":""},{"nom":"Design 3","image_url":""},{"nom":"Design 4","image_url":""}]'::jsonb,
  '["Blanc","Noir","Bleu","Rose","Vert"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- T-shirt phrase
INSERT INTO boutique_produits (nom, prix_centimes, actif, categorie, ordre, a_tailles, tailles_disponibles, designs, couleurs_disponibles)
VALUES (
  'T-shirt phrase', 0, true, 'vetements', 4, true,
  ARRAY['S','M','L','XL'],
  '[{"nom":"Phrase 1","image_url":""},{"nom":"Phrase 2","image_url":""},{"nom":"Phrase 3","image_url":""},{"nom":"Phrase 4","image_url":""}]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT DO NOTHING;

-- T-shirt club de sport
INSERT INTO boutique_produits (nom, prix_centimes, actif, categorie, ordre, a_tailles, tailles_disponibles, designs, couleurs_disponibles)
VALUES (
  'T-shirt club de sport', 0, true, 'vetements', 5, true,
  ARRAY['S','M','L','XL'],
  '[]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Ecocup
INSERT INTO boutique_produits (nom, prix_centimes, actif, categorie, ordre, a_tailles, tailles_disponibles, designs, couleurs_disponibles)
VALUES (
  'Ecocup', 0, true, 'accessoires', 6, false,
  ARRAY[]::text[],
  '[]'::jsonb,
  '[]'::jsonb
)
ON CONFLICT DO NOTHING;

-- 6. Configurer le pack T-shirt + Sweat = 1 Ecocup offert
DO $$
DECLARE
  id_tshirt     uuid;
  id_tshirt_phr uuid;
  id_sweat_col  uuid;
  id_sweat_cap  uuid;
  id_ecocup     uuid;
  pack_conds    jsonb;
BEGIN
  SELECT id INTO id_tshirt     FROM boutique_produits WHERE nom = 'T-shirt' LIMIT 1;
  SELECT id INTO id_tshirt_phr FROM boutique_produits WHERE nom = 'T-shirt phrase' LIMIT 1;
  SELECT id INTO id_sweat_col  FROM boutique_produits WHERE nom = 'Sweat col rond' LIMIT 1;
  SELECT id INTO id_sweat_cap  FROM boutique_produits WHERE nom = 'Sweat à capuche' LIMIT 1;
  SELECT id INTO id_ecocup     FROM boutique_produits WHERE nom = 'Ecocup' LIMIT 1;

  pack_conds := jsonb_build_array(
    jsonb_build_object('type','achat','produit_ids', jsonb_build_array(id_tshirt, id_tshirt_phr), 'min_qty', 1),
    jsonb_build_object('type','achat','produit_ids', jsonb_build_array(id_sweat_col, id_sweat_cap), 'min_qty', 1),
    jsonb_build_object('type','offre','produit_ids', jsonb_build_array(id_ecocup))
  );

  INSERT INTO boutique_packs (nom, description, actif, conditions, offre_qty)
  VALUES (
    'Pack T-shirt + Sweat',
    '1 T-shirt + 1 Sweat achetés = 1 Ecocup offert',
    true,
    pack_conds,
    1
  );
END $$;
