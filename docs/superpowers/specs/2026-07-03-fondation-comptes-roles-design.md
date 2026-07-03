# Bloc 0 — Fondation : comptes, connexion et rôles

Date : 2026-07-03
Statut : design validé, en attente de relecture avant plan d'implémentation

## Contexte

Le site BDE CREAD Lyon est aujourd'hui un site **statique** (pages HTML + fichiers
JSON dans le dépôt GitHub, édités via un panneau admin, avec une seule fonction
serverless `/api/tampon` protégée par un PIN partagé). Il n'existe **aucun compte
utilisateur**.

L'équipe veut transformer le site en plateforme avec des comptes et un accès par
« grade » :

- **etudiant** : créer ses annonces, discuter (chat), acheter/réserver des places.
- **membre** (BDE) : scanner le QR code de fidélité.
- **responsable** : accès au panneau admin actuel.
- **admin** : tout, plus billetterie (Stripe) et compta/stats.

Ce document ne conçoit que la **Fondation** (bloc 0). Les autres blocs auront chacun
leur propre spec. Ordre prévu :

- **0. Fondation** — comptes, login, 4 grades, contrôle d'accès. *(ce document)*
- 1. Espace étudiant + annonces
- 2. Scan avec comptes (remplace le PIN partagé)
- 3. Panneau admin derrière login réel
- 4. Chat entre étudiants
- 5. Billetterie Stripe
- 6. Compta + stats

## Décision de stack

**Supabase** (backend managé) : PostgreSQL + Auth + Realtime + Storage + Row-Level
Security (RLS). On **conserve les pages HTML actuelles** ; on ajoute la librairie
JS Supabase (une balise `<script>`, pas d'étape de build).

Raisons : professionnel (PostgreSQL, utilisé en production par de vraies
entreprises) **et** transmissible (tableau de bord + SQL standard, ultra-documenté),
gratuit jusqu'à bien au-delà de 500 utilisateurs, faible risque de verrouillage
(la base reste réutilisable si une équipe future veut refaire le front).

## Objectifs (bloc 0)

- Inscription **ouverte à tous**, rôle `etudiant` par défaut.
- Connexion / déconnexion / mot de passe oublié.
- Email de confirmation à l'inscription (anti-faux-comptes).
- 4 rôles **hiérarchiques** : `etudiant` ⊂ `membre` ⊂ `responsable` ⊂ `admin`.
- Un écran réservé admin pour changer le rôle des utilisateurs.
- Le plombing pour que n'importe quelle page sache « qui est connecté + quel rôle »
  et affiche/masque en conséquence.
- Sécurité réellement appliquée par la base (RLS), pas seulement par l'UI.

## Non-objectifs (hors bloc 0)

- Les fonctionnalités par rôle (annonces, chat, scan, billetterie, compta) — blocs
  suivants.
- La migration de l'admin actuel derrière le login — bloc 3.
- La double authentification (2FA) — amélioration future possible pour les admins.

## Modèle de données

Supabase gère lui-même `auth.users` (email + hash bcrypt du mot de passe, caché).

Table applicative `profils` :

| Colonne            | Type        | Notes                                                     |
|--------------------|-------------|-----------------------------------------------------------|
| `id`               | uuid (PK)   | = `auth.users.id`                                         |
| `email`            | text        | copie pour l'affichage (ne remplace pas auth)             |
| `prenom`           | text        |                                                           |
| `nom`              | text        |                                                           |
| `annee`            | text        | `1ère`\|`2ème`\|`3ème`\|`4ème`\|`5ème` (liste fixe)       |
| `telephone`        | text        | optionnel, non affiché publiquement                       |
| `avatar_url`       | text        | URL Supabase Storage (photo de profil, optionnel)         |
| `role`             | text        | `etudiant`\|`membre`\|`responsable`\|`admin` ; défaut `etudiant` |
| `notif_push`       | boolean     | accepte les notifications push ; défaut `true`            |
| `onesignal_id`     | text        | ID OneSignal de l'appareil, enregistré à la connexion     |
| `created_at`       | timestamptz | défaut `now()`                                            |

Un **trigger** crée automatiquement une ligne `profils` (role `etudiant`) à chaque
nouvelle inscription.

Note : `role` est volontairement une colonne texte simple (pas un système de
permissions complexe) pour rester lisible et transmissible.

## Notifications

Le projet a déjà **OneSignal** configuré (`OneSignalSDKWorker.js` à la racine).
On l'utilise comme canal principal de notification push (messages reçus, events, etc.).

**Stratégie :**
- À la connexion, on enregistre l'`onesignal_id` de l'utilisateur dans `profils`.
- Quand un événement déclencheur survient (nouveau message, etc.), une fonction
  Cloudflare appelle l'API OneSignal pour envoyer une push à l'`onesignal_id` cible.
- L'utilisateur peut désactiver les push (`notif_push = false`) depuis son profil.
- Email de fallback : non prévu en bloc 0 ; les emails Supabase Auth (confirmation,
  reset) utilisent le serveur SMTP intégré de Supabase. Les notifications de messages
  par email pourront être ajoutées au bloc 4 (Chat) si besoin.

**Portée bloc 0 :** on enregistre l'`onesignal_id` et la préférence `notif_push`.
L'envoi effectif des notifications est implémenté au bloc 4 (Chat).

## Rôles hiérarchiques

`etudiant` (1) ⊂ `membre` (2) ⊂ `responsable` (3) ⊂ `admin` (4). Un niveau donné
possède **aussi** les droits des niveaux inférieurs. Les règles s'expriment donc en
« rôle ≥ X ». Une fonction SQL `role_rang(role)` renvoie l'entier 1..4 pour
comparer.

## Parcours utilisateur

1. **Inscription** : formulaire en une page —
   - Email + mot de passe (min. 8 caractères) *(obligatoires)*
   - Prénom + nom *(obligatoires)*
   - Année d'étude (liste : 1ère … 5ème) *(obligatoire)*
   - Téléphone *(optionnel)*
   - Photo de profil *(optionnelle, uploadée dans Supabase Storage)*
   → compte créé en `etudiant`, email de confirmation envoyé. Le compte n'est
   pleinement actif qu'après confirmation.
   → l'utilisateur est invité à autoriser les notifications push (OneSignal) juste
   après l'inscription.
2. **Connexion** : email + mot de passe.
3. **Déconnexion**.
4. **Mot de passe oublié** : email de réinitialisation (fourni par Supabase).
5. **Premier admin (bootstrap)** : on change son propre `role` en `admin` une fois,
   à la main, dans le Table Editor Supabase. Ensuite les admins gèrent les rôles
   depuis le site.
6. **Gestion des rôles** : écran réservé admin listant les utilisateurs, avec un
   menu déroulant pour changer le grade de chacun.

## Sécurité & accès aux données

**Accès type phpMyAdmin** : le Table Editor Supabase donne une vue tableur de toutes
les tables (nom, email, téléphone…) + un éditeur SQL + export CSV. **Exception : les
mots de passe** sont hachés (bcrypt) et illisibles pour tout le monde, y compris le
propriétaire du projet.

**Deux couches** :

- **RLS (base de données)** = la vraie sécurité, appliquée quoi qu'il arrive.
  - RLS **activée sur toutes les tables** (règle absolue — la cause n°1 des fuites
    Supabase est une RLS oubliée).
  - `profils` :
    - lecture : un utilisateur lit son propre profil ; un `responsable`+ lit tous
      les profils.
    - écriture `prenom`/`nom` : uniquement son propre profil.
    - écriture `role` : uniquement `admin`.
- **UI (js/auth.js)** = confort seulement. Affiche/masque menus, boutons, pages
  selon le rôle. Ne protège rien en soi — masquer un bouton ne suffit jamais.

**Clés** : la clé **anon** (publique) est mise dans le JS ; elle ne peut faire que
ce que la RLS autorise, elle n'est pas un secret. La clé **service_role** (contourne
la RLS) ne va **jamais** dans le navigateur — seulement dans des fonctions serveur.

**Points faibles connus et parades** :
- Règles RLS incorrectes → **testées** (voir Tests).
- Mots de passe faibles → longueur minimale + email de confirmation.
- Fuite de la clé service_role → reste côté serveur uniquement.
- (Futur) 2FA possible pour les admins.

**Honnêteté** : aucun système n'est « zéro bug / impossible à casser ». Mais Supabase
Auth n'est pas du code qu'on écrit (donc pas de bug introduit par nous) et il est
nettement plus sûr que le PIN partagé actuel. Notre responsabilité se limite à des
règles RLS correctes et testées.

## Intégration au site actuel

- Ajout de la librairie Supabase (`<script>` CDN) — pas de build, cohérent avec le
  setup sans framework.
- Nouvelle page `connexion.html` : inscription + connexion + mot de passe oublié.
- Nouveau `js/auth.js`, fichier partagé exposant :
  - `getUser()` — utilisateur connecté (ou null).
  - `getRole()` — rôle courant.
  - `hasRole(min)` — vrai si `role ≥ min`.
  - `requireRole(min)` — redirige vers `connexion.html` si insuffisant.
  - `logout()`.
- Nouvelle page `admin-utilisateurs.html` (ou section) : gestion des rôles, réservée
  `admin`.
- Bandeau léger sur les pages : « Connecté : Prénom (rôle) » + bouton déconnexion.
- Les pages **publiques** (accueil, événements, partenaires, contact, mentions)
  restent publiques. Le gating n'arrive que sur les futures fonctions par bloc.
- Config Supabase (URL + clé anon) dans un petit `js/supabase-config.js`.

## Critères de réussite

- Un visiteur s'inscrit → confirme son email → devient `etudiant` et ne voit que
  l'UI étudiant.
- Un admin (bootstrap) ouvre `admin-utilisateurs.html`, promeut quelqu'un
  `membre`/`responsable`/`admin`, et l'accès de cette personne change au prochain
  chargement.
- Un visiteur non connecté voit le site public mais aucune zone réservée.
- Un `etudiant` qui tente d'accéder aux données réservées (ex : modifier un `role`)
  via l'API est **rejeté par la RLS**, pas seulement masqué dans l'UI.

## Tests

- **RLS `profils`** :
  - `etudiant` ne peut pas lire les profils des autres.
  - `etudiant` ne peut pas modifier son propre `role`.
  - `etudiant` ne peut pas modifier le profil d'un autre.
  - `admin` peut lire tous les profils et modifier n'importe quel `role`.
  - `responsable` peut lire tous les profils mais ne peut pas modifier un `role`.
- **Auth** :
  - inscription → ligne `profils` créée en `etudiant` (trigger).
  - connexion avec mauvais mot de passe → refusée.
  - accès à une page `requireRole('admin')` en `etudiant` → redirigé.
- **Bootstrap** : après passage manuel en `admin`, l'écran de gestion des rôles est
  accessible et fonctionnel.

## Questions ouvertes (à trancher aux blocs suivants)

- Champs de profil supplémentaires (téléphone, promo/année, avatar) — probablement
  bloc 1 (espace étudiant).
- Lien entre `profils` et la carte de fidélité existante — bloc 2 (scan).
- Faut-il un domaine email école pour filtrer les étudiants CREAD — reporté ;
  l'inscription reste ouverte pour l'instant.
