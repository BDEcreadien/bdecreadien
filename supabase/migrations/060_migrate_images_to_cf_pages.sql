-- Migration images boutique et liens vers Cloudflare Pages
-- Les images sont désormais servies depuis bdecreadien.fr/images/ (zéro egress Supabase)

UPDATE boutique_produits SET image_url = 'https://bdecreadien.fr/images/boutique/sweat-capuche-be-art.png'
WHERE image_url LIKE '%1793984589880-l07i3%';

UPDATE boutique_produits SET image_url = 'https://bdecreadien.fr/images/boutique/tshirt-fitness.png'
WHERE image_url LIKE '%1793984597417-ndt2m%';

UPDATE boutique_produits SET image_url = 'https://bdecreadien.fr/images/boutique/tshirt-red.png'
WHERE image_url LIKE '%1793984505126-saku3%';

UPDATE boutique_produits SET image_url = 'https://bdecreadien.fr/images/boutique/ecocup.png'
WHERE image_url LIKE '%1794009482076-6sb26%';

UPDATE boutique_produits SET image_url = 'https://bdecreadien.fr/images/boutique/sweat-col-rond-be-art.png'
WHERE image_url LIKE '%1793984577909-fdmoc%';

UPDATE boutique_produits SET image_url = 'https://bdecreadien.fr/images/boutique/tshirt-be-art.png'
WHERE image_url LIKE '%1793984565100-lzhyw%';

UPDATE liens SET image_url = 'https://bdecreadien.fr/images/liens/merch-bde.png'
WHERE image_url LIKE '%lnk-1792922138035-uigrd%';

UPDATE liens SET image_url = 'https://bdecreadien.fr/images/liens/photos-soirees.jpg'
WHERE image_url LIKE '%lnk-1789318089134-wmycb%';
