-- Ajoute la capacité totale d'une billetterie
ALTER TABLE billetteries
  ADD COLUMN IF NOT EXISTS places_max integer;
