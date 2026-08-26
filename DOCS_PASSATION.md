# Guide de passation — Site BDE CREAD Lyon

> Ce document doit être transmis d'un bureau au suivant chaque année.
> Dernière mise à jour : 26 août 2026

## 1. Vue d'ensemble technique

Le site `bdecreadien.fr` est composé de :

| Composant | Rôle | Service | Coût |
|---|---|---|---|
| **Frontend** | Pages HTML/CSS/JS statiques | Cloudflare Pages | Gratuit |
| **Backend / Base de données** | Comptes utilisateurs, annonces, cartes fidélité, newsletter | Supabase (Frankfurt UE) | Gratuit (Free plan) |
| **Emails** | Envoi de mails transactionnels (contact, newsletter, notifs) | Resend | Gratuit jusqu'à 3000 emails/mois |
| **Nom de domaine** | bdecreadien.fr | Cloudflare Registrar | ~10€/an |
| **Email pro** | contact@bdecreadien.fr → forward vers bdecreadien@gmail.com | Cloudflare Email Routing | Gratuit |
| **Code source** | Fichiers du site + historique | GitHub | Gratuit |
| **Auto-déploiement** | Push GitHub → rebuild automatique du site | Cloudflare Pages (webhook GitHub) | Gratuit |

**Total annuel** : ~10€ (nom de domaine uniquement).

---

## 2. Accès à récupérer / transmettre

### Priorité 1 — À faire dès le début du mandat

1. **Cloudflare** (le plus important — gère domaine, hébergement, email routing)
   - Compte principal : lié à l'email `bdecreadien@gmail.com`
   - Se connecter : https://dash.cloudflare.com
   - Vérifier accès à :
     - Le site `bdecreadien.fr` (Pages)
     - Le domaine `bdecreadien.fr` (Registrar → renouveler avant expiration)
     - L'Email Routing (contact@ → forward)

2. **Supabase** (base de données)
   - Compte principal : `bdecreadien@gmail.com`
   - Dashboard : https://supabase.com/dashboard
   - Projet : `bde-cread` (URL `zgscyfpqwbmwemzqtvpx.supabase.co`)
   - Ce qu'on peut y gérer :
     - Table Editor : voir/éditer les données (comptes, annonces, cartes fidélité, etc.)
     - Auth : gérer les utilisateurs (bannir, changer rôle, réinitialiser MDP)
     - Edge Functions : les fonctions serveur (email contact, newsletter, notifs)
     - Storage : les images (avatars, photos annonces)

3. **Resend** (envoi emails)
   - Compte : `bdecreadien@gmail.com`
   - Dashboard : https://resend.com/emails
   - Domaine vérifié : `bdecreadien.fr`
   - Clé API stockée dans Supabase → Edge Functions → Settings → Secrets → `RESEND_API_KEY`

4. **GitHub** (code source)
   - Repo : https://github.com/BDEcreadien/bdecreadien
   - Compte owner : à transmettre ou créer un compte partagé BDE

5. **Gmail** `bdecreadien@gmail.com`
   - Boîte de réception des messages contact + notifs
   - Mot de passe à transmettre au nouveau président

### Priorité 2 — Optionnel

6. **Instagram** `@bdecreadien` — transférer mot de passe
7. **OneSignal** (obsolète, désactivé) — peut être ignoré
8. **Google Analytics** — accès facultatif via Analytics.google.com

---

## 3. Faire de quelqu'un un membre BDE ou admin

Par défaut, tout utilisateur qui s'inscrit est `étudiant`. Pour lui donner des droits :

### Depuis Supabase (le plus simple)
1. Supabase Dashboard → **Table Editor** → table `profils`
2. Chercher la personne par email
3. Colonne `role` : changer `etudiant` → `membre` (droits BDE) ou `admin` (tous droits)
4. Sauvegarder (`Ctrl+Enter`)

### Depuis /admin.html
1. `/admin.html?page=parametres` → …
2. Ou passer par l'annuaire dans `/mon-espace` → onglet Administration → Membres

### Différence des rôles

| Rôle | Peut… |
|---|---|
| **etudiant** | Publier annonces (avec modération), demander adhésion BDE, avoir carte fidélité |
| **membre** | Modérer annonces, éditer événements/agenda, valider adhésions, tamponner cartes, envoyer newsletter |
| **admin** | Tout ce qui précède + gérer les autres membres, changer les rôles, supprimer des données, reset stats |

---

## 4. Workflow quotidien du BDE

### Publier un événement
1. `/admin.html?page=agenda` → **+ Nouvel événement**
2. Remplir titre, date, lieu, description, image, lien billetterie (Shotgun/HelloAsso)
3. Sauvegarder → apparaît sur `/agenda` et sur la home

### Modérer une annonce étudiante
Quand un étudiant publie, tu reçois un email de notification. Puis :
1. `/mon-espace` → onglet **BDE** → **Annonces** → tu vois celles en attente
2. Approuver / refuser

### Valider une demande d'adhésion BDE
1. Quand quelqu'un remplit `/rejoindre-bde` → email arrive dans bdecreadien@gmail.com
2. Contacter la personne pour un entretien
3. Si accepté : va dans Supabase → `profils` → change son `role` en `membre`

### Envoyer une newsletter
1. `/admin.html?page=newsletter`
2. Écrire sujet + contenu (utilise les boutons Gras, Titre, Lien, Image, Bouton)
3. Cliquer **Aperçu** pour vérifier
4. Cliquer **Envoyer la newsletter** → envoyé à tous les abonnés

### Tamponner une carte fidélité
- Depuis un téléphone : `/scan.html` → scanner le QR de l'étudiant → +1 tampon
- Ou depuis `/admin.html?page=fidelite` → chercher la carte → +Tampon

---

## 5. Où sont stockées les données ?

| Type de donnée | Où | Comment y accéder |
|---|---|---|
| Comptes utilisateurs | Supabase → `profils` | Table Editor |
| Emails abonnés newsletter | Supabase → `newsletter_subscribers` | Table Editor + Export CSV via /admin |
| Annonces étudiantes | Supabase → `annonces` | Table Editor + /admin |
| Événements agenda | JSON dans le repo GitHub → `_data/evenements.json` | Via `/admin.html?page=agenda` |
| Cartes fidélité | Supabase → `cartes_fidelite` | Table Editor + /admin |
| Statistiques trafic | Supabase → `analytics_events` | `/admin?page=stats` |

### Backup
Supabase Free plan fait **7 jours de backup automatique** (Point-In-Time Recovery limité). Pour aller plus loin, faire un export manuel régulier :
- Supabase → Database → Backups → Download backup

---

## 6. Édition du site (contenu texte / design)

Le code source est hébergé sur GitHub. Deux façons d'éditer :

### A. Via GitHub web (le plus simple pour du texte)
1. Aller sur https://github.com/BDEcreadien/bdecreadien
2. Cliquer sur le fichier à modifier
3. Cliquer l'icône crayon (Edit)
4. Modifier → Commit changes
5. **Le site se rebuild automatiquement en 2 minutes**

### B. En local (pour les gros changements)
```bash
git clone https://github.com/BDEcreadien/bdecreadien
cd bdecreadien
# Édite avec ton éditeur préféré (VS Code recommandé)
git add .
git commit -m "Description du changement"
git push
```

---

## 7. Problèmes courants et solutions

### Le site est down / inaccessible
1. Vérifier https://www.cloudflarestatus.com — Cloudflare a un problème ?
2. Vérifier https://status.supabase.com — Supabase down ?
3. Vérifier Cloudflare Pages → Deployments : la dernière build est-elle réussie ?

### Un étudiant n'arrive pas à se connecter
1. Vérifier son email est bien confirmé (Supabase → Auth → Users)
2. Renvoyer le mail de confirmation manuellement si besoin
3. Reset MDP : envoie-lui le lien "Mot de passe oublié" sur `/connexion`

### Un email de contact n'arrive pas
1. Vérifier Resend → Emails → voir si l'email est bien envoyé
2. Vérifier bdecreadien@gmail.com → spams
3. Si problème : vérifier la clé `RESEND_API_KEY` dans Supabase → Edge Functions → Secrets

### Renouveler le nom de domaine
- Cloudflare envoie un rappel par email 30 jours avant expiration
- Aller sur Cloudflare Dashboard → Domain Registration → renouveler (~10€/an)
- **NE PAS OUBLIER** : si expiré, le domaine peut être racheté par quelqu'un d'autre

---

## 8. Fichiers importants dans le code source

| Fichier | Rôle |
|---|---|
| `index.html` | Page d'accueil |
| `agenda.html` | Page événements |
| `annonces.html` | Page annonces |
| `communication.html` | Page équipe + bouton adhésion |
| `admin.html` | Interface d'administration |
| `mon-espace.html` | Espace personnel étudiant |
| `rejoindre-bde.html` | Formulaire d'adhésion public |
| `js/main.js` | Logique principale du site |
| `js/auth.js` | Gestion authentification |
| `js/tracker.js` | Tracker analytics maison |
| `css/style.css` | Design du site |
| `_data/evenements.json` | Base des événements |
| `_data/annonces-categories.json` | Catégories d'annonces |
| `supabase/migrations/*.sql` | Historique des migrations DB |
| `supabase/functions/*/index.ts` | Code des Edge Functions |

---

## 9. Où trouver de l'aide

- **Supabase docs** : https://supabase.com/docs
- **Cloudflare Pages docs** : https://developers.cloudflare.com/pages
- **Resend docs** : https://resend.com/docs
- **Ancien président** : à contacter pour les questions de contexte

---

## 10. Checklist de fin de mandat

Avant de quitter, le président sortant doit :

- [ ] Créer/mettre à jour ce document avec les nouveautés
- [ ] Transmettre les mots de passe (Cloudflare, Supabase, Resend, GitHub, Gmail, Instagram) au président entrant en main propre ou via 1Password/Bitwarden
- [ ] Faire une session de 1h avec le nouveau bureau pour montrer /admin en direct
- [ ] Faire un export CSV des abonnés newsletter (backup)
- [ ] Faire un backup manuel Supabase (Dashboard → Backups → Download)
- [ ] Vérifier que le rôle admin est bien attribué au nouveau président
- [ ] (Optionnel) retirer le rôle admin de l'ancien président si départ définitif

---

**Question ?** contact@bdecreadien.fr
