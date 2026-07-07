# Migrations SQL

Toutes les migrations sont dans `/supabase/migrations/`. Les exécuter dans l'ordre via Supabase → SQL Editor.

## 001_profils.sql (déjà appliqué)

Base auth : table `profils`, fonction `mon_role()`, trigger `handle_new_user`, policies RLS.

- Table `profils` avec FK vers `auth.users`
- Fonction `role_rang(text)` et `mon_role()` (security definer, évite récursion RLS)
- Trigger `on_auth_user_created` sur `auth.users` → INSERT dans `profils`

## 002_annonces.sql (déjà appliqué)

- Table `annonces`
- Policies : select published/own/bde, insert authentifié, update/delete auteur ou admin/responsable
- ⚠️ Encore avec `responsable` — remplacé plus tard par `membre` en migration 004

## 003_profil_evenements_feedback.sql (déjà appliqué)

- Ajoute `avatar_url` à `profils`
- Table `inscriptions_evenements` (+ policies)
- Table `feedbacks` (+ policies)
- Storage policies : upload authentifié pour `annonces` et `avatars`

## 004_demandes_bde.sql (à exécuter ou déjà fait)

- Table `demandes_membre_bde`
- **DROP + CREATE** des policies annonces/feedbacks/inscriptions pour :
  - Remplacer `responsable` par `membre` partout
  - Autoriser les membres BDE à modérer/lire
- Permet à l'admin d'update n'importe quel profil (pour changer les rôles)

## 008_admin_phase2.sql (à exécuter)

- `annonces.modere_par` uuid FK profils.id — trace qui a validé/refusé
- `annonces.modere_at` timestamptz — quand
- `profils.banni_jusqu_a` timestamptz — bannissement (null = pas banni)

## 007_membre_bde_phase2.sql (à exécuter)

Ajoute champs de réponse sur `feedbacks` :
- `reponse` text
- `repondu_par` uuid FK profils.id
- `repondu_at` timestamptz

## 006_etudiant_phase2.sql (à exécuter)

- Ajoute `sold` au CHECK constraint de `annonces.statut`
- Ajoute `annonces.motif_refus` text
- Ajoute `profils.email_bde_enabled` bool default true
- Ajoute `profils.notif_push` bool default true (au cas où)

## 005_bde_config.sql (à exécuter)

- Table `bde_config` (id text PK, value text)
- RLS : lecture membres+, écriture admin
- Utilisée pour partager le token GitHub entre membres BDE

## Comment vérifier qu'une migration est passée

Supabase → Database → Tables → vérifier que la table existe.
Supabase → Database → Policies → vérifier les policies actives.

## SQL rapide utile

### Promouvoir un user en admin manuellement
```sql
update public.profils set role = 'admin' where email = 'x@y.com';
```

### Voir toutes les policies d'une table
```sql
select * from pg_policies where tablename = 'annonces';
```

### Réinitialiser le token GitHub partagé
```sql
delete from public.bde_config where id = 'github_token';
```
