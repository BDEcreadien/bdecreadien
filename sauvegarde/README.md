# Sauvegarde — Mémoire du projet BDE CREAD Lyon

Documentation vivante pour retrouver rapidement le contexte du projet sans tout relire.

## Fichiers

| Fichier | Contenu |
|---|---|
| [00-etat-global.md](./00-etat-global.md) | Vue d'ensemble — où on en est |
| [01-architecture.md](./01-architecture.md) | Pages, rôles, permissions |
| [02-supabase.md](./02-supabase.md) | Config Supabase (URL, clés, tables, buckets) |
| [03-sql-migrations.md](./03-sql-migrations.md) | Toutes les migrations SQL |
| [04-fichiers-cles.md](./04-fichiers-cles.md) | Fichiers importants et leur rôle |
| [05-historique.md](./05-historique.md) | Historique des changements |
| [06-todo.md](./06-todo.md) | Ce qui reste à faire / idées |

## Règles pour maintenir cette mémoire

- **Après chaque session de dev** : ajouter au `05-historique.md` ce qui a changé
- **Après un ajout SQL** : mettre à jour `03-sql-migrations.md` avec le contenu exact
- **Après un nouveau fichier HTML/JS** : ajouter dans `04-fichiers-cles.md`
- **Modification de rôle/permission** : mettre à jour `01-architecture.md`
- **Nouvelle idée** : la mettre dans `06-todo.md`

## Ce qui NE doit PAS aller dans cette mémoire

- Le code lui-même (déjà versionné avec git)
- Les diffs (déjà dans git log)
- Les captures d'écran (elles vivent dans la conversation)

## Pour reprendre le projet plus tard

1. Lire `00-etat-global.md` en premier
2. Consulter `01-architecture.md` pour comprendre les rôles
3. Regarder `06-todo.md` pour savoir quoi faire ensuite
