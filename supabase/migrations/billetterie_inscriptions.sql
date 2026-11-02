-- Ajoute la config formulaire à la table billetteries
ALTER TABLE billetteries ADD COLUMN IF NOT EXISTS formulaire_champs jsonb DEFAULT '{}';

-- Table des inscriptions billetterie
CREATE TABLE IF NOT EXISTS billetterie_inscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billetterie_id uuid REFERENCES billetteries(id) ON DELETE CASCADE,
  billetterie_slug text NOT NULL,
  prenom        text NOT NULL,
  nom           text NOT NULL,
  email         text NOT NULL,
  tel           text,
  classe        text,
  suggestions   text,
  tarif_id      text,
  tarif_nom     text,
  quantite      int DEFAULT 1,
  statut        text DEFAULT 'en_attente',
  custom_answers jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE billetterie_inscriptions ENABLE ROW LEVEL SECURITY;

-- Admins et membres BDE voient tout
CREATE POLICY "membres_all" ON billetterie_inscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profils WHERE id = auth.uid() AND role IN ('admin', 'membre')
    )
  );

-- Tout le monde peut s'inscrire (insert public)
CREATE POLICY "public_insert" ON billetterie_inscriptions
  FOR INSERT WITH CHECK (true);
