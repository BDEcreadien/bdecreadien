# _includes/ — Partials du site

Ce dossier contient les blocs HTML réutilisés sur plusieurs pages.
**Modifier un fichier ici met à jour toutes les pages après un build.**

## Fichiers

| Fichier | Rôle | Utilisé sur |
|---|---|---|
| `nav.html` | Barre de navigation principale | Toutes les pages |
| `footer.html` | Pied de page complet | Pages publiques (index, agenda, communication, annonces, partenaires, contact, mentions-legales) |
| `scripts-public.html` | Bloc scripts fin de body (main.js, notif banner, OneSignal, Supabase, auth) | Pages publiques |

## Comment ajouter un partial dans une page HTML

Mets ces 2 marqueurs à l'endroit voulu :

```html
<!-- @include nav @start -->
<!-- @include nav @end -->
```

Puis lance `node build.js` — le contenu entre les marqueurs sera remplacé.

Le script est **idempotent** : tu peux le relancer sans problème.

## Comment modifier un élément partagé

1. Ouvre le fichier dans `_includes/` (ex : `nav.html`)
2. Fais tes modifications
3. Lance `node build.js` (ou `npm run build`)
4. Commit et push
5. Cloudflare Pages redéploie automatiquement

## Cloudflare Pages (build auto)

Dans Cloudflare Pages → Settings → Builds & deployments :
- **Build command** : `node build.js`
- **Build output directory** : `/` (racine)
- **Root directory** : `/`

Comme ça, chaque push déclenche le build automatiquement.

## Créer un nouveau partial

1. Crée `_includes/mon-partial.html` avec le contenu
2. Ajoute `<!-- @include mon-partial @start -->` et `<!-- @include mon-partial @end -->` dans les pages qui le veulent
3. Lance `node build.js`
