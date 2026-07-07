# Config Supabase

## Projet

- **URL** : https://zgscyfpqwbmwemzqtvpx.supabase.co
- **Anon key (publishable)** : `sb_publishable_m0ifDrZ8vL6MSMHPp00trQ_dkG3KzBm`
- **Service role key** : ⚠️ JAMAIS dans le frontend

Config stockée dans `js/supabase-config.js` (variables globales `SUPABASE_URL` et `SUPABASE_ANON`).

## SMTP (Brevo)

- Server : `smtp-relay.brevo.com`
- Port : `587`
- Login : `b10011001@smtp-brevo.com`
- Templates HTML personnalisés dans Supabase Auth → Emails → Templates
- Confirmation email OBLIGATOIRE

## Tables

### `profils` (migration 001)

Étend `auth.users`. Créée automatiquement par le trigger `on_auth_user_created` au signup.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK vers `auth.users.id` |
| `email` | text | copie de auth.users.email |
| `prenom` | text | via `raw_user_meta_data` |
| `nom` | text | |
| `annee` | text | ex "1ère", "2ème"… |
| `telephone` | numeric | |
| `role` | text | `etudiant` (défaut) / `membre` / `admin` |
| `avatar_url` | text | ajouté migration 003 |
| `notif_push` | bool | |
| `onesignal_id` | text | |
| `created_at` | timestamptz | |

### `annonces` (migration 002)

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `auteur_id` | uuid FK profils.id | |
| `titre`, `description` | text | |
| `categorie` | text | `materiel`/`place`/`logement`/`service`/`autre` |
| `prix`, `contact` | text nullable | |
| `photo_url` | text | URL publique bucket `annonces` |
| `statut` | text | `pending` (défaut) / `published` / `rejected` |
| `created_at` | timestamptz | |

### `inscriptions_evenements` (migration 003)

Bouton "Je viens" sur agenda.

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK profils.id | |
| `evenement_slug` | text | slug généré depuis titre + date |
| `evenement_titre` | text | snapshot au moment de l'inscription |
| `evenement_date` | date | |
| `created_at` | timestamptz | |
| UNIQUE(user_id, evenement_slug) | | |

### `feedbacks` (migration 003)

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `auteur_id` | uuid FK profils.id (SET NULL) | |
| `sujet`, `message` | text | |
| `statut` | text | `nouveau` (défaut) / `vu` / `traite` |
| `created_at` | timestamptz | |

### `demandes_membre_bde` (migration 004)

| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK profils.id UNIQUE | 1 seule demande par user |
| `motivation` | text | |
| `statut` | text | `pending`/`accepted`/`rejected` |
| `traite_par` | uuid FK profils.id | admin qui a traité |
| `created_at`, `updated_at` | timestamptz | |

### `bde_config` (migration 005)

Config partagée entre membres BDE (notamment le token GitHub).

| Colonne | Type | Notes |
|---|---|---|
| `id` | text PK | ex `github_token` |
| `value` | text | |
| `updated_at` | timestamptz | |
| `updated_by` | uuid FK profils.id | |

## Buckets Storage

### `avatars` (public)
- Limite : 5 MB par fichier
- Upload/update/delete réservés au propriétaire
- Path convention : `{user_id}/avatar-{timestamp}.jpg`

### `annonces` (public)
- Limite : 5 MB par fichier
- Upload : authentifié (n'importe quel user connecté)
- Delete : propriétaire OU membre/admin
- Path convention : `{user_id}/{timestamp}.jpg`

## Fonctions SQL

### `mon_role()` (security definer)

```sql
select role from public.profils where id = auth.uid();
```

Utilisée dans TOUTES les policies pour éviter la récursion RLS.

### `handle_new_user()` (trigger)

Créé une ligne dans `profils` à chaque signup, lit prenom/nom/annee/telephone depuis `auth.users.raw_user_meta_data`.

## RLS policies importantes

Toutes les tables ont RLS activé.

- `profils` : select/update propre + admin peut update n'importe qui
- `annonces` : voir published + les siennes ; membres+ voient tout ; update pending par auteur ou membres+
- `feedbacks` : auteur voit ses feedbacks ; membres+ voient tout et peuvent update
- `inscriptions_evenements` : chacun voit les siennes, membres+ voient tout
- `demandes_membre_bde` : auteur voit la sienne, admins voient tout et peuvent update
- `bde_config` : lecture membres+, écriture admins
