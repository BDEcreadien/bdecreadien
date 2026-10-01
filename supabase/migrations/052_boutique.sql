-- Migration 052 — Boutique BDE (merch / goodies)
-- Tables: boutique_produits, boutique_designs, boutique_produit_designs,
--         boutique_packs, boutique_commandes, boutique_items, boutique_remises

CREATE SEQUENCE IF NOT EXISTS boutique_commande_seq START 1;

-- Catalogue produits
CREATE TABLE IF NOT EXISTS public.boutique_produits (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           text    NOT NULL,
  description   text    DEFAULT '',
  image_url     text    DEFAULT '',
  categorie     text    DEFAULT 'vetement',   -- 'vetement' | 'accessoire'
  a_designs     boolean NOT NULL DEFAULT false,
  a_tailles     boolean NOT NULL DEFAULT false,
  tailles_disponibles text[] DEFAULT '{}',
  prix_centimes int     NOT NULL DEFAULT 0,
  max_par_commande int  NOT NULL DEFAULT 10,
  actif         boolean NOT NULL DEFAULT true,
  ordre         int     DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Designs (4 designs, partagés entre produits)
CREATE TABLE IF NOT EXISTS public.boutique_designs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        text NOT NULL,
  image_url  text DEFAULT '',
  actif      boolean NOT NULL DEFAULT true,
  ordre      int DEFAULT 0
);

-- Liaison produit ↔ design
CREATE TABLE IF NOT EXISTS public.boutique_produit_designs (
  produit_id uuid REFERENCES public.boutique_produits(id) ON DELETE CASCADE,
  design_id  uuid REFERENCES public.boutique_designs(id)  ON DELETE CASCADE,
  PRIMARY KEY (produit_id, design_id)
);

-- Packs promo
CREATE TABLE IF NOT EXISTS public.boutique_packs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              text NOT NULL,
  description      text DEFAULT '',
  conditions       jsonb NOT NULL DEFAULT '[]', -- [{produit_id, min_qty}]
  offre_produit_id uuid REFERENCES public.boutique_produits(id),
  offre_qty        int  NOT NULL DEFAULT 1,
  actif            boolean NOT NULL DEFAULT true
);

-- Commandes (panier sauvegardé, en_attente, confirmée, physique…)
CREATE TABLE IF NOT EXISTS public.boutique_commandes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          text UNIQUE,                   -- BDE-2026-XXXX, généré par trigger
  type            text NOT NULL DEFAULT 'online', -- 'online' | 'physique'
  statut          text NOT NULL DEFAULT 'panier',
  -- statuts: panier | en_attente | confirmee | remise | annulee | expiree
  membre_id       uuid REFERENCES public.profils(id),
  nom_acheteur    text NOT NULL DEFAULT '',
  email_acheteur  text NOT NULL DEFAULT '',
  total_centimes  int  NOT NULL DEFAULT 0,
  moyen_paiement  text DEFAULT 'helloasso',       -- helloasso | especes | sumup
  helloasso_ref   text,
  cree_par        uuid REFERENCES public.profils(id), -- BDE member for physical
  notes           text DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Génère le numéro lors du passage de 'panier' → autre statut
CREATE OR REPLACE FUNCTION public.boutique_set_numero()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.statut <> 'panier' AND (OLD.numero IS NULL OR OLD.statut = 'panier') THEN
    NEW.numero := 'BDE-' || EXTRACT(YEAR FROM now())::text || '-'
               || LPAD(nextval('boutique_commande_seq')::text, 4, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_boutique_commande_numero ON public.boutique_commandes;
CREATE TRIGGER trg_boutique_commande_numero
  BEFORE UPDATE ON public.boutique_commandes
  FOR EACH ROW EXECUTE FUNCTION public.boutique_set_numero();

-- Numéro immédiat pour les commandes physiques (insert direct sans statut panier)
CREATE OR REPLACE FUNCTION public.boutique_set_numero_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.statut <> 'panier' AND NEW.numero IS NULL THEN
    NEW.numero := 'BDE-' || EXTRACT(YEAR FROM now())::text || '-'
               || LPAD(nextval('boutique_commande_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_boutique_commande_numero_insert ON public.boutique_commandes;
CREATE TRIGGER trg_boutique_commande_numero_insert
  BEFORE INSERT ON public.boutique_commandes
  FOR EACH ROW EXECUTE FUNCTION public.boutique_set_numero_insert();

-- Lignes de commande (snapshot prix/nom à la commande)
CREATE TABLE IF NOT EXISTS public.boutique_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id           uuid REFERENCES public.boutique_commandes(id) ON DELETE CASCADE,
  produit_id            uuid REFERENCES public.boutique_produits(id),
  produit_nom           text NOT NULL,
  design_id             uuid,
  design_nom            text,
  taille                text,
  quantite              int  NOT NULL DEFAULT 1 CHECK (quantite >= 1 AND quantite <= 10),
  prix_unitaire_centimes int NOT NULL,
  est_offert            boolean NOT NULL DEFAULT false,
  created_at            timestamptz DEFAULT now()
);

-- Remises (qui a remis quoi, quand)
CREATE TABLE IF NOT EXISTS public.boutique_remises (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid REFERENCES public.boutique_commandes(id) ON DELETE CASCADE,
  remis_par   uuid REFERENCES public.profils(id),
  notes       text DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.boutique_produits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_designs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_produit_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_packs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_commandes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boutique_remises         ENABLE ROW LEVEL SECURITY;

-- Lecture publique du catalogue
DROP POLICY IF EXISTS "btq_produits_lect"   ON public.boutique_produits;
DROP POLICY IF EXISTS "btq_designs_lect"    ON public.boutique_designs;
DROP POLICY IF EXISTS "btq_pd_lect"         ON public.boutique_produit_designs;
DROP POLICY IF EXISTS "btq_packs_lect"      ON public.boutique_packs;
CREATE POLICY "btq_produits_lect"   ON public.boutique_produits        FOR SELECT USING (true);
CREATE POLICY "btq_designs_lect"    ON public.boutique_designs          FOR SELECT USING (true);
CREATE POLICY "btq_pd_lect"         ON public.boutique_produit_designs  FOR SELECT USING (true);
CREATE POLICY "btq_packs_lect"      ON public.boutique_packs            FOR SELECT USING (true);

-- Écriture catalogue : bureau uniquement
DROP POLICY IF EXISTS "btq_produits_bureau" ON public.boutique_produits;
DROP POLICY IF EXISTS "btq_designs_bureau"  ON public.boutique_designs;
DROP POLICY IF EXISTS "btq_pd_bureau"       ON public.boutique_produit_designs;
DROP POLICY IF EXISTS "btq_packs_bureau"    ON public.boutique_packs;
CREATE POLICY "btq_produits_bureau" ON public.boutique_produits FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true));
CREATE POLICY "btq_designs_bureau"  ON public.boutique_designs  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true));
CREATE POLICY "btq_pd_bureau"       ON public.boutique_produit_designs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true));
CREATE POLICY "btq_packs_bureau"    ON public.boutique_packs    FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true));

-- Commandes : membre voit les siennes, bureau voit tout
DROP POLICY IF EXISTS "btq_cmd_lect"   ON public.boutique_commandes;
DROP POLICY IF EXISTS "btq_cmd_insert" ON public.boutique_commandes;
DROP POLICY IF EXISTS "btq_cmd_update" ON public.boutique_commandes;
DROP POLICY IF EXISTS "btq_cmd_delete" ON public.boutique_commandes;
CREATE POLICY "btq_cmd_lect"   ON public.boutique_commandes FOR SELECT
  USING (membre_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true));
CREATE POLICY "btq_cmd_insert" ON public.boutique_commandes FOR INSERT
  WITH CHECK (membre_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true));
CREATE POLICY "btq_cmd_update" ON public.boutique_commandes FOR UPDATE
  USING (membre_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true));
CREATE POLICY "btq_cmd_delete" ON public.boutique_commandes FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true));

-- Items : accès via la commande
DROP POLICY IF EXISTS "btq_items_lect"  ON public.boutique_items;
DROP POLICY IF EXISTS "btq_items_write" ON public.boutique_items;
CREATE POLICY "btq_items_lect"  ON public.boutique_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.boutique_commandes c WHERE c.id = commande_id
    AND (c.membre_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true))));
CREATE POLICY "btq_items_write" ON public.boutique_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.boutique_commandes c WHERE c.id = commande_id
    AND (c.membre_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true))));

-- Remises : bureau uniquement
DROP POLICY IF EXISTS "btq_remises_bureau" ON public.boutique_remises;
CREATE POLICY "btq_remises_bureau" ON public.boutique_remises FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true));

-- ============================================================
-- SEED : données initiales
-- ============================================================
DO $$
DECLARE
  tid uuid; psid uuid; paid uuid; tsid uuid; chid uuid; muid uuid; pkid uuid;
  d1 uuid; d2 uuid; d3 uuid; d4 uuid;
BEGIN
  INSERT INTO public.boutique_designs (nom, actif, ordre) VALUES
    ('Design 1', true, 1), ('Design 2', true, 2),
    ('Design 3', true, 3), ('Design 4', true, 4)
  ON CONFLICT DO NOTHING;

  SELECT id INTO d1 FROM public.boutique_designs WHERE nom='Design 1';
  SELECT id INTO d2 FROM public.boutique_designs WHERE nom='Design 2';
  SELECT id INTO d3 FROM public.boutique_designs WHERE nom='Design 3';
  SELECT id INTO d4 FROM public.boutique_designs WHERE nom='Design 4';

  INSERT INTO public.boutique_produits (nom, categorie, a_designs, a_tailles, tailles_disponibles, prix_centimes, ordre)
  VALUES ('T-shirt', 'vetement', true, true, ARRAY['XS','S','M','L','XL','XXL'], 2000, 1) RETURNING id INTO tid;

  INSERT INTO public.boutique_produits (nom, categorie, a_designs, a_tailles, tailles_disponibles, prix_centimes, ordre)
  VALUES ('Pull sans capuche', 'vetement', true, true, ARRAY['XS','S','M','L','XL','XXL'], 3500, 2) RETURNING id INTO psid;

  INSERT INTO public.boutique_produits (nom, categorie, a_designs, a_tailles, tailles_disponibles, prix_centimes, ordre)
  VALUES ('Pull à capuche', 'vetement', true, true, ARRAY['XS','S','M','L','XL','XXL'], 4000, 3) RETURNING id INTO paid;

  INSERT INTO public.boutique_produits (nom, categorie, a_designs, a_tailles, tailles_disponibles, prix_centimes, ordre)
  VALUES ('T-shirt Club de Sport', 'vetement', false, true, ARRAY['XS','S','M','L','XL','XXL'], 2000, 4) RETURNING id INTO tsid;

  INSERT INTO public.boutique_produits (nom, categorie, a_designs, a_tailles, tailles_disponibles, prix_centimes, ordre)
  VALUES ('Chaussettes', 'accessoire', false, false, '{}', 1000, 5) RETURNING id INTO chid;

  INSERT INTO public.boutique_produits (nom, categorie, a_designs, a_tailles, tailles_disponibles, prix_centimes, ordre)
  VALUES ('Tasse', 'accessoire', false, false, '{}', 1200, 6) RETURNING id INTO muid;

  INSERT INTO public.boutique_produits (nom, categorie, a_designs, a_tailles, tailles_disponibles, prix_centimes, max_par_commande, ordre)
  VALUES ('Porte-clef', 'accessoire', false, false, '{}', 500, 10, 7) RETURNING id INTO pkid;

  -- Designs sur T-shirt, Pull sans capuche, Pull à capuche
  INSERT INTO public.boutique_produit_designs (produit_id, design_id) VALUES
    (tid, d1),(tid, d2),(tid, d3),(tid, d4),
    (psid,d1),(psid,d2),(psid,d3),(psid,d4),
    (paid,d1),(paid,d2),(paid,d3),(paid,d4)
  ON CONFLICT DO NOTHING;

  -- Pack : T-shirt + Pull sans capuche → porte-clef offert
  INSERT INTO public.boutique_packs (nom, description, conditions, offre_produit_id, offre_qty) VALUES (
    'Pack T-shirt + Pull sans capuche',
    'Achète un T-shirt + un Pull sans capuche → porte-clef offert !',
    jsonb_build_array(
      jsonb_build_object('produit_id', tid::text, 'min_qty', 1),
      jsonb_build_object('produit_id', psid::text,'min_qty', 1)
    ), pkid, 1
  );
  -- Pack : T-shirt + Pull à capuche → porte-clef offert
  INSERT INTO public.boutique_packs (nom, description, conditions, offre_produit_id, offre_qty) VALUES (
    'Pack T-shirt + Pull à capuche',
    'Achète un T-shirt + un Pull à capuche → porte-clef offert !',
    jsonb_build_array(
      jsonb_build_object('produit_id', tid::text, 'min_qty', 1),
      jsonb_build_object('produit_id', paid::text,'min_qty', 1)
    ), pkid, 1
  );
END $$;
