# État global du projet

**Domaine** : bdecreadien.fr (Cloudflare Pages, deploy auto depuis git push)
**Repo GitHub** : `BDEcreadien/bdecreadien` (branche `main`)
**Owner** : Tom Maradan (maradantom@gmail.com)

## Ce qui est fonctionnel

### Site public
- index, agenda, communication, annonces, partenaires, contact, mentions-legales
- Événements chargés depuis `_data/evenements.json` (édités via `/admin.html`)
- Annonces = merge de `_data/annonces.json` (statiques) + Supabase (étudiantes validées)
- Notifications push OneSignal (App ID `8c4f2a28-64eb-4417-85c9-20bda4365e45`) — actives uniquement sur bdecreadien.fr
- Analytics Google (`G-C8REVEGYYL`) + Cloudflare
- Carte fidélité + QR code (`carte.html`, `scan.html`)

### Auth Supabase
- Inscription / connexion / reset password
- Confirmation email obligatoire (SMTP Brevo)
- 3 rôles : `etudiant` → `membre` → `admin`
- Trigger `on_auth_user_created` : crée automatiquement une ligne dans `profils` au signup

### Espace étudiant (`/profil.html`)
- Avatar upload (compression côté client → 256px)
- Édition prénom/nom/téléphone/année
- Mes annonces (avec statut pending/published/rejected)
- Mes événements (à venir + passés, via bouton "Je viens" sur agenda)
- Feedback au BDE
- Changement mot de passe
- Demande d'adhésion BDE (étudiants uniquement)

### Espace BDE (`/bde.html`) — membre+
- Stats : annonces à valider, feedbacks nouveaux, demandes (admin)
- Modération annonces → `/admin-annonces.html`
- Liste des feedbacks avec statuts (nouveau/vu/traité)
- **Admin uniquement** : demandes d'adhésion (accepter promeut en `membre`), gestion utilisateurs, contenu du site

### Édition contenu du site (`/admin.html`)
- Auth Supabase (rôle membre+)
- Token GitHub partagé via table `bde_config` (plus besoin de le retaper)
- Édition JSON : événements, équipe, galerie, partenaires, config, annonces categories
- Stats GA4 (optionnel, à configurer)
- Cartes de fidélité

## Ce qui reste à finaliser

Voir [`06-todo.md`](./06-todo.md).

## Aide-mémoire domaines

- **Prod** : https://bdecreadien.fr
- **Preview** : https://bdecreadien.pages.dev
- **Supabase** : https://zgscyfpqwbmwemzqtvpx.supabase.co
- **Brevo (SMTP)** : b10011001@smtp-brevo.com
