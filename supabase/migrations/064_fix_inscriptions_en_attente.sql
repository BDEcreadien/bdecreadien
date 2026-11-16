-- Passe toutes les inscriptions en_attente en payee
-- (ceux qui ont abandonné leur paiement resteront vides car jamais confirmés par HelloAsso)
UPDATE billetterie_inscriptions
SET statut = 'payee'
WHERE statut = 'en_attente';
