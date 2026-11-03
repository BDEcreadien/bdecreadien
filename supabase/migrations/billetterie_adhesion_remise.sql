-- Lien entre une inscription et un compte utilisateur
ALTER TABLE billetterie_inscriptions ADD COLUMN IF NOT EXISTS profil_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Remise boutique accordée aux adhérents confirmés de cette billetterie
ALTER TABLE billetteries ADD COLUMN IF NOT EXISTS remise_boutique_centimes int DEFAULT 0;

-- Index pour chercher rapidement les adhésions d'un profil
CREATE INDEX IF NOT EXISTS idx_bil_insc_profil ON billetterie_inscriptions(profil_id, statut);
