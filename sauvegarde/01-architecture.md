# Architecture — pages, rôles, permissions

## Hiérarchie des rôles

```
etudiant (1) → membre (2) → admin (3)
```

- **etudiant** : rôle par défaut à l'inscription
- **membre** : promu depuis étudiant via demande acceptée (ou changement manuel admin)
- **admin** : changement manuel via `/admin-utilisateurs.html` ou directement Supabase Table Editor

Constantes dans `js/auth.js` :
```js
const RANG   = { etudiant: 1, membre: 2, admin: 3 };
const LABELS = { etudiant: 'Étudiant', membre: 'Membre BDE', admin: 'Admin' };
```

## Matrice pages / accès

| Page | Public | Étudiant | Membre BDE | Admin |
|---|---|---|---|---|
| `index.html` | ✅ | ✅ | ✅ | ✅ |
| `agenda.html` (+ bouton "Je viens") | ✅ (lecture) | ✅ | ✅ | ✅ |
| `communication.html` | ✅ | ✅ | ✅ | ✅ |
| `annonces.html` | ✅ (lecture) | ✅ | ✅ | ✅ |
| `partenaires.html` | ✅ | ✅ | ✅ | ✅ |
| `contact.html` | ✅ | ✅ | ✅ | ✅ |
| `connexion.html` | ✅ | (redirige si connecté) | (redirige si connecté) | (redirige si connecté) |
| `profil.html` | ❌ | ✅ | ✅ | ✅ |
| `annonces-nouvelle.html` | ❌ | ✅ | ✅ | ✅ |
| `carte.html` | ✅ (avec token) | ✅ | ✅ | ✅ |
| `bde.html` | ❌ | ❌ | ✅ | ✅ |
| `admin-annonces.html` | ❌ | ❌ | ❌ | ❌ (redirige vers `/bde.html#annonces`) |
| `admin-utilisateurs.html` | ❌ | ❌ | ❌ | ❌ (redirige vers `/bde.html#utilisateurs`) |
| `admin.html` | ❌ | ❌ | ✅ (attente si pas de token) | ✅ |
| `scan.html` | ✅ (BDE) | | | |

⚠️ Note : `admin-annonces.html` a été relâché à membre+ dans la migration 004 (policies annonces update autorisent membre+), mais le frontend fait `requireRole('admin')`. Si tu veux que les membres puissent modérer, change ce check à `'membre'`.

## Ce que chaque rôle peut faire

### Étudiant
- Éditer son profil (prénom/nom/tel/année/avatar)
- Publier une annonce (statut `pending` par défaut)
- Voir ses annonces avec statut
- Supprimer ses propres annonces
- Cliquer "Je viens" sur les événements
- Envoyer un feedback
- Envoyer une demande d'adhésion BDE

### Membre BDE
- Tout ce que fait un étudiant
- Voir toutes les annonces (même pending)
- Modérer les annonces (SQL policies l'autorisent, mais le bouton admin-annonces.html check `admin`)
- Voir les feedbacks
- Changer le statut des feedbacks (nouveau/vu/traité)
- Voir les inscriptions aux événements
- Éditer le contenu du site via `/admin.html` (si token GitHub configuré)

### Admin
- Tout ce que fait un membre
- Voir les demandes d'adhésion BDE
- Accepter une demande → promeut l'étudiant en `membre`
- Refuser une demande
- Gérer les rôles de tous les utilisateurs
- Configurer le token GitHub partagé (première fois)

## Auth flow

1. `Auth.requireRole('membre')` sur page protégée
2. Si non connecté → redirect `connexion.html?next=...`
3. Si rôle insuffisant → même redirect
4. Sinon : `Auth.getProfil()` renvoie le profil avec `.role`

## Nav chip (auth.js)

Affiché en haut à droite dans la navbar :
- **Non connecté** : lien blanc "Connexion" (style comme les autres liens)
- **Connecté étudiant** : juste le prénom (lien → `/profil.html`)
- **Connecté membre/admin** : chip gradient "BDE" + prénom
