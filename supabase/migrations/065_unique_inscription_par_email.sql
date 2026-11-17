-- Contrainte unique : un seul billet actif par email par billetterie
-- Les annulations/remboursements permettent de se réinscrire

-- D'abord supprimer les doublons encore présents (garder le plus ancien)
DELETE FROM billetterie_inscriptions a
USING billetterie_inscriptions b
WHERE a.created_at > b.created_at
  AND lower(a.email) = lower(b.email)
  AND a.billetterie_slug = b.billetterie_slug
  AND a.statut NOT IN ('annulee', 'remboursee');

-- Index unique partiel : actif seulement pour les inscriptions non-annulées
CREATE UNIQUE INDEX IF NOT EXISTS billetterie_inscriptions_slug_email_active_idx
  ON billetterie_inscriptions (billetterie_slug, lower(email))
  WHERE statut NOT IN ('annulee', 'remboursee');
