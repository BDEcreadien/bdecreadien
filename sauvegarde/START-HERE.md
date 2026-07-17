# BDE CREAD Lyon — Contexte de démarrage rapide

> Colle ce fichier en début de conversation pour donner tout le contexte à Claude sans relire les logs.
> Mis à jour : 2026-07-16

---

## Projet en bref

Site vitrine + plateforme étudiant du BDE CREAD Lyon.
- **URL prod** : https://bdecreadien.fr
- **Preview** : https://bdecreadien.pages.dev
- **Hébergeur** : Cloudflare Pages (deploy auto au push sur `main`)
- **Build command** : `node build.js` (partials `_includes/`)
- **Repo local** : `/Users/maradantom/Documents/Archi/CREAD/BDE/BDE/SiteBDE/`
- **Owner** : Tom Maradan (maradantom@gmail.com)

---

## Stack technique

| Élément | Détail |
|---|---|
| Hébergement | Cloudflare Pages (statique) |
| Auth + DB | Supabase (PostgreSQL + RLS) |
| Email | Brevo SMTP (`b10011001@smtp-brevo.com`, port 587) |
| Push notifs | OneSignal App ID `8c4f2a28-64eb-4417-85c9-20bda4365e45` (prod seulement) |
| Analytics | Google `G-C8REVEGYYL` + Cloudflare |

### Supabase
- **URL** : `https://zgscyfpqwbmwemzqtvpx.supabase.co`
- **Anon key** : `sb_publishable_m0ifDrZ8vL6MSMHPp00trQ_dkG3KzBm`
- **Service role** : ⚠️ JAMAIS dans le frontend

---

## Rôles

```
etudiant (1) → membre (2) → admin (3)
```

Promu via demande acceptée dans `/bde.html` (admin valide).

---

## Pages importantes

| Page | Accès | Rôle |
|---|---|---|
| `profil.html` | Tout utilisateur connecté | Profil perso, annonces, événements, feedback, paramètres |
| `bde.html` | membre+ | Dashboard unifié : annonces, feedbacks, inscriptions, annuaire, demandes (admin), membres (admin) |
| `admin.html` | membre+ | Éditeur JSON (événements, équipe, galerie...) via token GitHub |
| `connexion.html` | public | Signup/login/reset |
| `annonces-nouvelle.html` | connecté | Dépôt annonce (pending si étudiant, direct si membre+) |
| `agenda.html` | public | Bouton "Je viens" (Supabase) |
| `annonces.html` | public | Merge JSON + Supabase published |

`admin-annonces.html` et `admin-utilisateurs.html` = redirections vers `/bde.html#annonces` et `#utilisateurs`.

---

## Scripts JS clés

### `js/supabase-config.js`
```js
const SUPABASE_URL  = 'https://zgscyfpqwbmwemzqtvpx.supabase.co';
const SUPABASE_ANON = 'sb_publishable_m0ifDrZ8vL6MSMHPp00trQ_dkG3KzBm';
```

### `js/auth.js` — expose `window.Auth`
- `getProfil()` — cache profil, auto-signout si orphelin (user sans ligne profils)
- `requireRole(min)` — redirect si rôle insuffisant
- `logout()` — signout + redirect `/`
- `sb` — client Supabase brut
- Init DOMContentLoaded : `initNavChip()` + `syncOneSignalId()`
- ⚠️ Constantes globales : `RANG`, `LABELS` — ne pas redéclarer dans les pages

### `js/main.js` — constantes globales à ne PAS redéclarer
- `const CAT_LABELS` — catégories événements
- `let annoncesData`, `let _mesInscriptions`
- Dans les scripts inline : utiliser `PROFIL_CAT_LABELS`, `BDE_ANNONCES`, etc. ou wrapper en IIFE

### Cache-bust actuel
- `style.css?v=10`, `auth.js?v=4`, `main.js?v=4`
- Bumper à chaque modif impactante

---

## Tables Supabase (résumé)

| Table | Colonnes clés |
|---|---|
| `profils` | id, email, prenom, nom, annee, telephone, role, avatar_url, notif_push, onesignal_id, banni_jusqu_a |
| `annonces` | id, auteur_id, titre, description, categorie, prix, contact, photo_url, statut (pending/published/rejected/sold), motif_refus, modere_par, modere_at |
| `inscriptions_evenements` | id, user_id, evenement_slug, evenement_titre, evenement_date |
| `feedbacks` | id, auteur_id, sujet, message, statut (nouveau/vu/traite), reponse, repondu_par, repondu_at |
| `demandes_membre_bde` | id, user_id, motivation, statut (pending/accepted/rejected), traite_par |
| `bde_config` | id (text PK, ex `github_token`), value |

Migrations exécutées : 001 à 008.
Fonction SQL `mon_role()` (security definer) utilisée dans toutes les policies pour éviter la récursion RLS.

---

## Partials (`_includes/`)

```
_includes/nav.html         — nav bar
_includes/footer.html      — footer
_includes/scripts-public.html — main.js + OneSignal + Supabase + auth
```

Marqueurs dans les HTML : `<!-- @include nav @start -->...<!-- @include nav @end -->`
`build.js` remplace le contenu. Lancer `node build.js` puis commit/push.

---

## État au 2026-07-16

### Fonctionnel ✅
- Auth Supabase complète (signup / login / reset / confirmation email Brevo)
- `profil.html` : tabs Aperçu / Mes annonces / Mes événements / Paramètres
- `bde.html` : dashboard unifié membres + admin
- Bouton "Je viens" sur agenda
- Annonces : dépôt étudiant → modération BDE
- Avatar upload (compression 256px côté client)
- Feedback form + réponse BDE
- Demandes d'adhésion BDE
- Token GitHub partagé via `bde_config`
- Partials `_includes/` + `build.js`

### À faire / vérifier
- Configurer Cloudflare Pages : Build command = `node build.js`, Output dir = `/`
- Tester flow complet : signup → demande adhésion → acceptation → membre
- Notifications email/push quand annonce validée/refusée (pas encore fait)
- Expiration auto annonces 60 jours (pas encore fait)

---

## Piège connu — const globaux

`main.js` déclare au top-level : `const CAT_LABELS`, `let annoncesData`, `let _mesInscriptions`.
Redéclarer ces noms dans un `<script>` inline = SyntaxError silencieuse = page entière morte.
**Toujours préfixer** (`PROFIL_CAT_LABELS`, etc.) ou wrapper en IIFE.

---

## Pour aller vite dans une nouvelle conversation

1. Colle ce fichier en message d'intro
2. Dis ce que tu veux faire
3. Claude lira uniquement les fichiers concernés avant de modifier
