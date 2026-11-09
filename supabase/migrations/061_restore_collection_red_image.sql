-- Restaurer l'image_url de Collection Red - T-shirt (nullifiée par btqaSaveProduit quand galerie vide)
UPDATE boutique_produits
SET image_url = 'https://bdecreadien.fr/images/boutique/tshirt-red.png'
WHERE nom = 'Collection Red - T-shirt'
  AND (image_url IS NULL OR image_url = '');
