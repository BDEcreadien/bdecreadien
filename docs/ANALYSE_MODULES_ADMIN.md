# Analyse des modules de l'admin, pour un produit utilisable par n'importe quel BDE

Objectif : une instance par BDE, créée à partir d'un modèle commun, avec une admin neutre
et paramétrable. Cette analyse liste, module par module, ce qu'il faut améliorer, supprimer ou
rendre générique. Les constats « en dur » viennent d'une recherche dans le code (nombre
d'occurrences de CREAD, du domaine, de clés, etc.) ; le reste est un jugement de produit.

Priorités : P1 = bloquant pour un autre BDE, P2 = important, P3 = confort.

## Constats transverses (à traiter avant les modules)

| # | Constat | Priorité |
|---|---|---|
| T1 | **Le contenu du site (agenda, annonces, médias, équipe, galerie, partenaires) est enregistré en committant des fichiers JSON dans le dépôt GitHub du BDE** (`REPO = 'BDEcreadien/bdecreadien'` dans `core.js`, jeton GitHub dans la base). Un autre BDE devrait posséder un dépôt GitHub, un jeton et un déploiement. À remplacer par des tables de la base (le reste de l'admin y est déjà). | P1 |
| T2 | **Secrets accessibles à tous les membres** : la table `bde_config` contient le jeton GitHub et le secret d'upload, lisibles par tout membre du BDE. Une clé Foursquare est écrite en clair dans `core.js` (`FSQ_KEY`) ; elle semble inutilisée : la supprimer et la révoquer. Rien de tout cela ne doit rester côté navigateur. Régénérer le jeton GitHub, révoquer la clé Foursquare. | P1 |
| T3 | **Adresses et services propres à CREAD en dur** : `bdecreadien.fr` (liens QR, fidélité, planning, mails), `sumup-proxy.bdecreadien.workers.dev`, `bde-notif.bdecreadien.workers.dev`, dépôt `BDEcreadien/bdecreadien`, jeton de la tâche planifiée (`helloasso-sync`). Tout doit venir des paramètres ou de la configuration de l'instance. | P1 |
| T4 | **Mails automatiques** : « CREAD » et les textes sont dans le code de 10 fonctions. À alimenter par les paramètres (nom, expéditeur, couleurs, lieu de retrait) avec des textes modifiables depuis l'admin. | P1 |
| T5 | **Paiement = HelloAsso uniquement** (France). Prévoir un « fournisseur de paiement » au choix (HelloAsso, Stripe, paiement sur place) ou au minimum rendre HelloAsso optionnel. | P2 |
| T6 | **Deux pages « Paramètres »** (contenu de la page Contact et identité du BDE) : renommée « Page Contact » pour lever la confusion. | Fait |
| T7 | **Finances en double** : un module dans l'admin et `finances-v2.html` à part. Garder un seul module (la v2 est plus claire). | P2 |
| T8 | **Une seule langue (français)** et des formats fixes (€, année scolaire sept→août). Rendre devise, début d'année scolaire et langue configurables. | P3 |
| T9 | **Pas d'assistant de création** d'un BDE : un script ou un écran qui crée la base, applique les migrations, pose les paramètres de départ et crée le premier administrateur. | P1 |

## Module par module

### Paramètres du BDE (nouveau, repris maintenant)
- Fait : onglets (Identité, Apparence, Contact, Site & e-mails, Association, Modules), aperçu en direct, couleurs qui pilotent l'admin et le site, palette libre (ajout/suppression), validation, avertissement de modifications non enregistrées, modules activables.
- À faire : brancher réellement chaque paramètre (voir T3/T4), assistant de première configuration, import/export de la configuration d'un BDE vers un autre.

### Page Contact (ancien « Paramètres »)
- Éditeur des chiffres clés et des canaux de contact de la page publique. Écrit dans un JSON du dépôt GitHub (T1).
- Améliorer : passer en base de données ; icônes de réseaux proposées plus complètes (Snapchat, Twitch, X) ; aperçu.
- Supprimer : le champ `contact.instagram` qui double les paramètres du BDE (utiliser les paramètres).

### Contenu du site (Accueil, Agenda, Archives, Annonces, Communication, Galerie, Partenaires)
- Le plus gros chantier (T1). Écran de choix de pages puis éditeurs séparés.
- Améliorer : une seule interface « Pages » avec un éditeur de blocs ; brouillon / publication ; aperçu avant publication ; galerie en glisser-déposer (déjà amorcé).
- À rendre générique : pôles de l'équipe (aujourd'hui listés dans une configuration CREAD), exemples « CREAD15 », « promo-cread », « prenom@cread.fr » dans les champs d'aide.
- Supprimer : la constante `FSQ_KEY` (clé Foursquare non utilisée). L'autocomplétion de lieu passe déjà par Nominatim.

### Boutique / Merchandising
- Très complet : commandes et statuts, vente physique, remises, récap et stock par design/couleur/taille, configuration des produits, analytiques, relances, QR de retrait.
- Améliorer : fichier de 3 500 lignes à découper en sous-modules (commandes, stock, produits, remises) ; contrôle du prix et de la clôture côté serveur ; réconciliation des paiements ; cas des commandes à 0 € ; réglages « fenêtre de vente » (ouverture et clôture) dans l'interface plutôt que dans le code.
- À rendre générique : « Be Art » (reconnu par nom dans le récap par design), textes des mails d'étape, nom du PDF « Récap commandes », lieu et horaires de retrait.
- Supprimer : la dépendance à GitHub pour les images (déjà en R2 ailleurs, nettoyer le reste).

### Billetterie
- Pages de vente par événement, tarifs, codes promo, inscriptions, scan à l'entrée.
- Améliorer : rendre HelloAsso optionnel (T5) ; export des inscrits ; modèle de page de vente personnalisable ; gratuit / payant dans le même flux.
- Peu de texte propre à CREAD : c'est le module le plus proche d'être générique. À reprendre en premier.

### Finances
- Trésorerie, transactions, récurrentes, courbe annuelle, événements prévisionnels, rapport PDF, import SumUp.
- Améliorer : un seul module (T7) ; budget par catégorie ; justificatifs rattachés aux transactions.
- À rendre générique : import SumUp → import CSV bancaire générique ; PDF avec nom et coordonnées du BDE (aujourd'hui en dur) ; année scolaire configurable.

### Facturation
- Création et archivage de factures PDF. Les coordonnées de l'émetteur sont dans un réglage séparé.
- Améliorer : reprendre automatiquement les informations de l'association depuis les paramètres ; numérotation configurable.
- Supprimer : le réglage « émetteur » dupliqué.

### Organisation du bureau (planning)
- Événements, tâches, inscriptions des membres, modèles, notifications.
- Améliorer : nom du module (« Organisation soirée membre BDE » est trop long et trop spécifique) ; rappels automatiques ; vue calendrier.
- À rendre générique : adresse des liens et du service de notification.

### Newsletter
- Abonnés (actifs / désinscrits), envois, aperçu.
- Améliorer : programmation d'un envoi ; segments ; statistiques d'ouverture.
- À rendre générique : le gabarit du mail (couleurs, logo, nom) doit venir des paramètres.

### Fidélité
- Cartes étudiants et tampons.
- Améliorer : lien de la carte construit depuis l'adresse du site configurée ; paliers de récompense paramétrables.

### Liens (page /menu)
- Équivalent d'un « linktree » avec statistiques de clics. Module simple et déjà générique ; vérifier seulement l'adresse des images.

### QR code dynamique
- Redirection modifiable sans réimpression.
- À rendre générique : l'adresse imprimée `bdecreadien.fr/qr` et le nom du fichier téléchargé ; logo du BDE intégré automatiquement.

### Statistiques
- Fréquentation du site, taille du dépôt.
- Supprimer : la taille du dépôt GitHub (inutile pour un autre BDE, dépend de T1).
- Améliorer : pages les plus vues, sources, période comparée.

## Ordre de travail proposé
1. Paramètres du BDE (fait, à brancher partout).
2. T2 et T3 : sortir les secrets et les adresses en dur.
3. Billetterie, Boutique, Finances (modules les plus utilisés).
4. T1 : contenu du site vers la base de données.
5. T9 : assistant de création d'un nouveau BDE.
