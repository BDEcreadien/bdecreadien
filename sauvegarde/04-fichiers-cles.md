# Fichiers clés

## Pages HTML

| Fichier | Rôle | Chargements |
|---|---|---|
| `index.html` | Accueil public | main.js, auth.js (chip nav) |
| `agenda.html` | Liste événements + "Je viens" | main.js (rendu events + toggle), auth.js |
| `annonces.html` | Liste annonces (JSON + Supabase merged) | main.js (loadSupabaseAnnonces), auth.js |
| `communication.html` | Équipe BDE + galerie | main.js |
| `partenaires.html` | Sponsors | main.js |
| `contact.html` | Formulaire Web3Forms | main.js |
| `connexion.html` | Login/signup/reset password | supabase-js direct (pas main.js pour éviter conflits) |
| `profil.html` | Panel étudiant complet | auth.js + Supabase |
| `annonces-nouvelle.html` | Formulaire dépôt annonce | auth.js + Supabase Storage upload |
| `bde.html` | Dashboard membres/admins | auth.js (requireRole membre) |
| `admin-annonces.html` | Modération annonces | auth.js (requireRole admin) |
| `admin-utilisateurs.html` | Gestion rôles | auth.js (requireRole admin) |
| `admin.html` | Éditeur JSON legacy | auth.js (requireRole membre) + token GitHub via bde_config |
| `carte.html`, `scan.html` | Fidélité (QR code) | localStorage |
| `404.html` | Page erreur | |
| `mentions-legales.html` | Mentions | |

## Scripts JS

### `js/supabase-config.js`
```js
const SUPABASE_URL  = 'https://zgscyfpqwbmwemzqtvpx.supabase.co';
const SUPABASE_ANON = 'sb_publishable_m0ifDrZ8vL6MSMHPp00trQ_dkG3KzBm';
```

### `js/auth.js`

Expose `window.Auth` avec :
- `getUser()` — user auth Supabase
- `getProfil(forceRefresh = false)` — cache profil, auto-signout si orphelin
- `getRole()`
- `hasRole(role, min)` — compare avec `RANG`
- `requireRole(min)` — redirect si insuffisant
- `logout()` — signout + redirect `/`
- `sb` — client Supabase brut

Init au DOMContentLoaded :
- `initNavChip()` — insère le chip Connexion / Prénom / BDE dans `ul.nav-links`
- `syncOneSignalId()` — associe le OneSignal player ID au profil

Constantes :
```js
const RANG   = { etudiant: 1, membre: 2, admin: 3 };
const LABELS = { etudiant: 'Étudiant', membre: 'Membre BDE', admin: 'Admin' };
```

### `js/main.js`

Contient :
- Rendu accueil (events, vidéos)
- Rendu agenda avec `renderEvenements()`, `drawList()`, bouton "Je viens"
  - `eventSlug(ev)` — génère un slug normalisé titre + date
  - `_mesInscriptions` — Set global des slugs inscrits (populé au boot)
  - `loadMesInscriptions()` — fetch depuis Supabase
  - `toggleJeViens(btn)` — insert/delete inscription
- Rendu annonces avec merge JSON + Supabase
  - `waitForSupabase(maxWait)` — attend `window._sb` (top-level, hoisted)
  - `loadSupabaseAnnonces()` — fetch published + join profils
  - `contactHref(c)` — smart mailto/tel/insta
- Modales, filtres, service worker enregistrement

## Fichiers de données (JSON)

Dans `_data/` :
- `evenements.json` — événements à venir
- `archives.json` — événements passés
- `annonces.json` — annonces statiques (BDE-curated, distinctes des Supabase)
- `annonces-categories.json`
- `equipe.json` — membres du bureau
- `videos.json` — vidéos accueil
- `galerie.json` — photos galerie
- `partenaires.json` — sponsors
- `config.json` — chiffres clés, contact, Instagram

Édités via `/admin.html` qui les commit en direct sur GitHub via l'API + le token stocké dans `bde_config`.

## Cache-bust versions

Dernières versions actives :
- `style.css?v=10`
- `auth.js?v=4`
- `main.js?v=4`

Bumper d'une version à chaque modification impactante :
```bash
grep -rl "style.css?v=10" *.html | xargs sed -i '' 's/style.css?v=10/style.css?v=11/g'
```

## Deploy

- Push sur `main` → Cloudflare Pages build automatique (~30-60s)
- Pas de CI, pas de tests
- Preview URL : https://bdecreadien.pages.dev
