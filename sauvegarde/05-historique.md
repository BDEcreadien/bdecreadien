# Historique

Ordre chronologique inverse (plus récent en haut).

Consulter `git log --oneline` pour l'historique commit exact.

## 2026-07-07 — Étudiant phase 2

- **SQL 006** : statut `sold` sur annonces, `motif_refus` sur annonces, `email_bde_enabled` + `notif_push` sur profils
- `profil.html` : bouton "Vendue" sur mes annonces published, affichage motif refus si rejected, section Notifications avec toggles push+email, section Historique (membre depuis, annonces vendues, événements totaux)
- `admin-annonces.html` : accès rôle `membre` (au lieu de `admin`), prompt pour motif de refus au rejet

## 2026-07-06 — Espace BDE + demandes d'adhésion + token GitHub partagé

- **SQL 004** : table `demandes_membre_bde` + policies remplacent `responsable` par `membre`
- **SQL 005** : table `bde_config` pour partager le token GitHub
- **Nouveau `bde.html`** : dashboard unifié membres/admins
- **Nouveau `profil.html` enrichi** : avatar, "Rejoindre le BDE", stats, feedback
- **Nouveau `annonces-nouvelle.html`** : formulaire dépôt avec upload compressé
- **Nouveau `admin-annonces.html`** : modération pending/published/rejected
- **Nouveau `admin-utilisateurs.html`** : gestion des rôles
- **`admin.html` modernisé** : auth Supabase (membre+) + token GitHub auto depuis `bde_config`
- Hiérarchie rôles simplifiée à 3 niveaux : `etudiant → membre → admin`
- Bouton "Je viens" sur `agenda.html` avec inscription Supabase
- CTA "+ Publier une annonce" remplace les mailto sur `annonces.html`
- Nav chip : lien "BDE" gradient pour membres+, prénom cliquable → profil

## 2026-07-05 — Auth Supabase + emails Brevo

- **SQL 001-003** : profils, annonces, avatars/événements/feedbacks
- **SMTP Brevo** configuré (7 templates HTML brandés BDE)
- Bouton "Retour à l'accueil" écran succès inscription
- Message d'erreur "email non confirmé" spécifique
- Correction : `.maybeSingle()` au lieu de `.single()` pour éviter 406 sur profil orphelin
- Fix : nav "Connexion" redesigné (gradient), phone obligatoire, "Mot de passe" tab retirée

## Sessions précédentes (pré-Supabase)

- Carte fidélité redesignée : format credit-card, QR code centré
- Archivage nightly des événements passés via GitHub Actions
- OneSignal notifications push configuré
- Base du site public (index/agenda/etc.) et admin.html legacy avec GitHub PAT
