ALTER TABLE billetterie_inscriptions
  ADD COLUMN IF NOT EXISTS boisson_scannee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boisson_at timestamptz;
