# TODO / Idées

## À finir

- [ ] Exécuter migration **005** (`bde_config`) dans Supabase — sinon `/admin.html` demandera toujours le token
- [ ] Vérifier que la migration **004** est bien passée (demandes + policies membre)
- [ ] Tester le flow complet : signup étudiant → demande adhésion → accept admin → devenu membre

## Features priorité 1 (utiles mais pas urgentes)

- [ ] Notification quand une annonce est validée/refusée (email ou OneSignal)
- [ ] Notification quand une demande d'adhésion est traitée
- [ ] Notification admins quand une nouvelle demande d'adhésion arrive
- [x] ~~Page dédiée pour voir les inscriptions par événement~~ ✅ 2026-07-07 (embedded dans /bde.html + export CSV)
- [x] ~~Bouton "Marquer comme vendu" sur les annonces (statut `sold`)~~ ✅ 2026-07-07
- [ ] Expiration auto des annonces après 60 jours (via cron GitHub Actions ou trigger SQL)
- [ ] Compression + optimisation des images uploadées via Cloudflare Images (si besoin de scaler)

## Features priorité 2 (nice-to-have)

- [ ] Trombinoscope de promo (opt-in "Je veux apparaître")
- [ ] Système de messages privés entre étudiants (pour les annonces)
- [ ] Badges/gamification : premier événement, X annonces vendues
- [ ] Historique membre : "Membre depuis...", nb événements assistés
- [ ] Parrainage avec lien tracker
- [ ] Toggle notifications push par l'utilisateur (on/off) sur profil
- [ ] Export CSV de la liste des inscrits à un événement (admin)

## Refactoring / dette technique

- [ ] Migration progressive des JSON (`_data/*.json`) vers Supabase (events, équipe, galerie)
  - Une fois fait, plus besoin de token GitHub → suppression de `bde_config.github_token`
- [ ] Nettoyer les résidus de `responsable` dans les CSS (harmless mais dead code)
- [ ] Unifier les naming conventions (btn-primary vs profil-btn vs bde-btn vs auth-btn)

## ⚠️ Pièges connus (ne pas refaire)

- **Scripts inline + globaux** : `main.js` a des `const CAT_LABELS`, `let annoncesData`, `let _mesInscriptions` en top-level. Ne PAS re-déclarer ces noms dans un `<script>` inline (même page = même scope global → SyntaxError silencieuse → tout le script meurt). Toujours préfixer : `PROFIL_CAT_LABELS`, `BDE_ANNONCES`, etc. Ou wrapper l'inline dans une IIFE `(function(){ ... })()`.

## Bugs connus / à surveiller

- Le CTA `/admin.html` n'est visible que pour admin (pas membre) alors que membre peut y accéder
- Le nav chip peut clignoter au chargement (le fetch profil est async)
- OneSignal ne marche qu'en prod (bdecreadien.fr), errors en localhost = normales

## Domaine à finaliser

- Quand bdecreadien.fr est acheté définitivement :
  - Mettre à jour l'URL dans OneSignal (currently probably still on .pages.dev)
  - Ajouter les origines autorisées dans Google OAuth (si stats configurées)
  - Rediriger l'ancien domaine si applicable

## Idées Membre BDE

À développer / affiner ensuite :
- Onboarding membre : liste de tâches (uploader avatar, lire charte, etc.)
- Zone privée BDE : notes, planning, PV de réunions
- Système de vote pour décisions BDE
- Budget tracking
