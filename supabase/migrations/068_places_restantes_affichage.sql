-- Config d'affichage des places restantes sur la page publique
ALTER TABLE billetteries
  ADD COLUMN IF NOT EXISTS places_restantes_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS places_restantes_seuil   integer,
  ADD COLUMN IF NOT EXISTS places_restantes_mode    varchar(10) NOT NULL DEFAULT 'exact';
