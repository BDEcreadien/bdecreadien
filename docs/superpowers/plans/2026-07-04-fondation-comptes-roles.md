# Fondation — Comptes, Connexion et Rôles — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place comptes utilisateurs, connexion, 4 rôles hiérarchiques et protection des données via Supabase — sans toucher à la structure du site existant.

**Architecture:** Site statique HTML/JS conservé tel quel. On ajoute la librairie Supabase (CDN `<script>`) + deux fichiers JS partagés (`supabase-config.js`, `auth.js`) + deux nouvelles pages (`connexion.html`, `admin-utilisateurs.html`). La sécurité réelle est assurée par Row-Level Security (RLS) côté base de données Supabase. L'UI s'adapte au rôle via un module JS partagé chargé sur toutes les pages.

**Tech Stack:** Supabase (PostgreSQL + Auth + Storage + RLS), Supabase JS SDK v2 (CDN), HTML/CSS/JS vanilla, OneSignal (déjà en place), Cloudflare Pages.

## Global Constraints

- Pas de build system. Tout le JS est vanilla, chargé via `<script>` dans le HTML.
- Font : `Barlow` / `Barlow Condensed` / `Bebas Neue` (Google Fonts, déjà chargés dans `css/style.css`).
- Variables CSS disponibles : `--violet` (#463A90), `--orange` (#E85100), `--gradient`, `--gris-clair`, `--gris-texte`, `--transition`.
- La clé **anon** Supabase va dans `js/supabase-config.js` (public). La clé **service_role** ne va JAMAIS dans le front.
- RLS activée sur TOUTES les tables — aucune exception.
- Commits fréquents, un commit par tâche terminée.
- Mot de passe minimum : 8 caractères (configuré dans Supabase Auth, pas de vérification JS côté client).
- Les pages publiques existantes (index.html, agenda.html, etc.) ne changent pas de comportement. On ajoute seulement les `<script>` auth au bas du `<body>`.

---

## Fichiers créés / modifiés

| Fichier | Action | Responsabilité |
|---|---|---|
| `supabase/migrations/001_profils.sql` | Créer | Schéma complet : table, trigger, fonction `mon_role()`, `role_rang()`, RLS |
| `js/supabase-config.js` | Créer | URL + clé anon Supabase |
| `js/auth.js` | Créer | Module partagé : getUser, getProfil, getRole, hasRole, requireRole, logout, nav chip |
| `connexion.html` | Créer | Page connexion / inscription / reset |
| `admin-utilisateurs.html` | Créer | Gestion des rôles (admin seulement) |
| `index.html` | Modifier | Ajouter `<script>` auth en bas de body |
| `agenda.html` | Modifier | Idem |
| `annonces.html` | Modifier | Idem |
| `communication.html` | Modifier | Idem |
| `partenaires.html` | Modifier | Idem |
| `contact.html` | Modifier | Idem |

---

## Task 1 : Projet Supabase + schéma SQL + Storage

**Files:**
- Create: `supabase/migrations/001_profils.sql`

**Interfaces:**
- Produit : table `public.profils`, fonctions `mon_role()` et `role_rang(text)`, trigger `on_auth_user_created`, RLS, bucket `avatars`.
- Consommé par : toutes les tâches suivantes.

---

- [ ] **Étape 1 : Créer le projet Supabase (manuel)**

  Va sur [supabase.com](https://supabase.com) → "New project".
  - Nom : `bde-cread`
  - Région : `West EU (Paris)` ou proche
  - Mot de passe DB : génère-en un fort et note-le dans un endroit sûr.

  Une fois créé, va dans **Project Settings → API** et note :
  - `Project URL` (ex: `https://abcdefghij.supabase.co`)
  - `anon` / `public` key (commence par `eyJ`)

---

- [ ] **Étape 2 : Configurer l'authentification Supabase (manuel)**

  Dans le dashboard Supabase, va dans **Authentication → Configuration** :
  - **Email confirmations** : `enabled` (obligatoire).
  - **Minimum password length** : `8`.
  - **Site URL** : `https://bdecreadien.fr`
  - **Redirect URLs** : ajoute `https://bdecreadien.fr/connexion.html`, `http://localhost:5501/connexion.html`

---

- [ ] **Étape 3 : Créer le bucket Storage (manuel, pour bloc 1)**

  Dans **Storage → New bucket** :
  - Nom : `avatars`
  - Public : `true` (les avatars sont affichables sans authentification)
  - Taille max : `2 MB`

  > Ce bucket sera utilisé dès le bloc 1 (photo de profil après connexion).
  > On le crée maintenant pour ne pas avoir à y revenir.

---

- [ ] **Étape 4 : Écrire le fichier SQL de migration**

  Crée `supabase/migrations/001_profils.sql` avec le contenu suivant :

  ```sql
  -- ============================================================
  -- Migration 001 : table profils, trigger, fonctions, RLS
  -- À exécuter dans Supabase SQL Editor (une seule fois)
  -- ============================================================

  -- Table profils
  create table if not exists public.profils (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        text not null,
    prenom       text not null default '',
    nom          text not null default '',
    annee        text not null default '1ère'
                   check (annee in ('1ère','2ème','3ème','4ème','5ème')),
    telephone    text,
    avatar_url   text,
    role         text not null default 'etudiant'
                   check (role in ('etudiant','membre','responsable','admin')),
    notif_push   boolean not null default true,
    onesignal_id text,
    created_at   timestamptz not null default now()
  );

  -- Fonction rang hiérarchique (utilisée dans les policies)
  create or replace function public.role_rang(r text)
  returns int language sql immutable as $$
    select case r
      when 'etudiant'     then 1
      when 'membre'       then 2
      when 'responsable'  then 3
      when 'admin'        then 4
      else 0
    end
  $$;

  -- Fonction mon_role() : rôle de l'utilisateur connecté
  -- security definer évite la récursivité infinie dans les policies RLS
  create or replace function public.mon_role()
  returns text language sql security definer stable as $$
    select role from public.profils where id = auth.uid()
  $$;

  -- Trigger : créer une ligne profils à chaque inscription
  create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer as $$
  begin
    insert into public.profils (id, email, prenom, nom, annee, telephone)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'prenom', ''),
      coalesce(new.raw_user_meta_data->>'nom', ''),
      coalesce(new.raw_user_meta_data->>'annee', '1ère'),
      new.raw_user_meta_data->>'telephone'  -- null si non fourni, c'est ok
    );
    return new;
  end;
  $$;

  drop trigger if exists on_auth_user_created on auth.users;
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

  -- ============================================================
  -- RLS
  -- ============================================================
  alter table public.profils enable row level security;

  -- Un utilisateur peut lire son propre profil
  drop policy if exists "lecture propre profil" on public.profils;
  create policy "lecture propre profil"
    on public.profils for select
    using (auth.uid() = id);

  -- Responsable et au-dessus lisent tous les profils
  drop policy if exists "responsable lit tous les profils" on public.profils;
  create policy "responsable lit tous les profils"
    on public.profils for select
    using (role_rang(public.mon_role()) >= 3);

  -- Un utilisateur peut modifier son propre profil (sauf la colonne role)
  -- mon_role() est security definer → pas de récursion RLS
  drop policy if exists "modification propre profil" on public.profils;
  create policy "modification propre profil"
    on public.profils for update
    using (auth.uid() = id)
    with check (
      auth.uid() = id
      and role = public.mon_role()
    );

  -- Admin peut modifier n'importe quel profil (y compris role)
  drop policy if exists "admin modifie tout" on public.profils;
  create policy "admin modifie tout"
    on public.profils for update
    using (role_rang(public.mon_role()) >= 4);

  -- Politique Storage : tout le monde peut lire les avatars (bucket public)
  -- Les policies Storage se configurent dans le dashboard, pas en SQL.
  -- Vérifier dans Storage → Policies que le bucket "avatars" autorise SELECT pour tous.
  ```

---

- [ ] **Étape 5 : Exécuter la migration (manuel)**

  Dans le dashboard Supabase → **SQL Editor** → colle le contenu de `001_profils.sql` → Run.

  Résultat attendu : `Success. No rows returned.`

---

- [ ] **Étape 6 : Configurer les policies Storage (manuel)**

  Dans **Storage → Policies → avatars** :
  - `SELECT` : `true` (lecture publique pour afficher les avatars)
  - `INSERT` : `auth.uid() is not null` (tout utilisateur connecté peut uploader son avatar)
  - `UPDATE` : `auth.uid()::text = (storage.foldername(name))[1]` (ne peut mettre à jour que son propre avatar)
  - `DELETE` : idem UPDATE

---

- [ ] **Étape 7 : Vérifier dans le Table Editor**

  Dans **Table Editor**, clique sur `profils` — la table doit exister avec toutes ses colonnes.

---

- [ ] **Étape 8 : Commit**

  ```bash
  git add supabase/migrations/001_profils.sql
  git commit -m "feat: migration SQL profils, RLS, trigger new user"
  git push
  ```

---

## Task 2 : `js/supabase-config.js` + `js/auth.js`

**Files:**
- Create: `js/supabase-config.js`
- Create: `js/auth.js`

**Interfaces:**
- Produit : objet global `Auth` avec `getUser()`, `getProfil()`, `getRole()`, `hasRole(role, min)`, `requireRole(min)`, `logout()`, `initNavChip()`.
- Consommé par : `connexion.html`, `admin-utilisateurs.html`, toutes les pages publiques (pour le nav chip).

---

- [ ] **Étape 1 : Créer `js/supabase-config.js`**

  Remplace `VOTRE_URL` et `VOTRE_CLE_ANON` par les valeurs notées à la Task 1.

  ```javascript
  // js/supabase-config.js
  // Clé anon = publique, sans danger. Ne pas mettre la clé service_role ici.
  const SUPABASE_URL  = 'VOTRE_URL';   // ex: https://abcdefghij.supabase.co
  const SUPABASE_ANON = 'VOTRE_CLE_ANON';
  ```

---

- [ ] **Étape 2 : Créer `js/auth.js`**

  ```javascript
  // js/auth.js
  // Module d'authentification partagé — chargé sur toutes les pages.
  // Dépend de : supabase-config.js (SUPABASE_URL, SUPABASE_ANON) chargé avant.

  (() => {
    const { createClient } = supabase;
    const sb = createClient(SUPABASE_URL, SUPABASE_ANON);
    window._sb = sb; // exposé pour les pages qui en ont besoin

    const RANG = { etudiant: 1, membre: 2, responsable: 3, admin: 4 };
    const LABELS = { etudiant: 'Étudiant', membre: 'Membre BDE', responsable: 'Responsable', admin: 'Admin' };

    // Cache session courante pour éviter des appels réseau répétés
    let _profil = null;

    async function getUser() {
      const { data: { user } } = await sb.auth.getUser();
      return user;
    }

    async function getProfil(forceRefresh = false) {
      if (_profil && !forceRefresh) return _profil;
      const user = await getUser();
      if (!user) { _profil = null; return null; }
      const { data } = await sb.from('profils').select('*').eq('id', user.id).single();
      _profil = data;
      return _profil;
    }

    async function getRole() {
      const p = await getProfil();
      return p?.role ?? null;
    }

    function hasRole(role, min) {
      return (RANG[role] ?? 0) >= (RANG[min] ?? 0);
    }

    // Redirige vers connexion.html si le rôle est insuffisant.
    // Paramètre min : 'etudiant'|'membre'|'responsable'|'admin'
    async function requireRole(min) {
      const role = await getRole();
      if (!role || !hasRole(role, min)) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = '/connexion.html?next=' + next;
        return false;
      }
      return true;
    }

    async function logout() {
      await sb.auth.signOut();
      _profil = null;
      window.location.href = '/connexion.html';
    }

    // Injecte un chip "Connecté : Prénom (rôle)" dans la nav.
    // Appelé automatiquement sur DOMContentLoaded.
    async function initNavChip() {
      const nav = document.querySelector('nav');
      if (!nav) return;

      const profil = await getProfil();
      if (!profil) {
        // Non connecté : affiche un lien "Connexion"
        const a = document.createElement('a');
        a.href = '/connexion.html';
        a.className = 'nav-auth-chip';
        a.textContent = 'Connexion';
        nav.appendChild(a);
        return;
      }

      const chip = document.createElement('div');
      chip.className = 'nav-auth-chip nav-auth-chip--connected';
      chip.innerHTML = `
        <span class="nav-auth-name">${profil.prenom} <span class="nav-auth-role">${LABELS[profil.role] ?? profil.role}</span></span>
        <button class="nav-auth-logout" onclick="Auth.logout()">Déconnexion</button>
      `;
      nav.appendChild(chip);
    }

    // API publique
    window.Auth = { getUser, getProfil, getRole, hasRole, requireRole, logout, sb };

    // Init automatique au chargement
    document.addEventListener('DOMContentLoaded', initNavChip);
  })();
  ```

---

- [ ] **Étape 3 : Ajouter les styles du nav chip dans `css/style.css`**

  Ajoute à la fin de `css/style.css` :

  ```css
  /* ===================================
     AUTH — nav chip
     =================================== */
  .nav-auth-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    white-space: nowrap;
  }

  .nav-auth-chip:not(.nav-auth-chip--connected) {
    color: white;
    text-decoration: none;
    padding: 6px 14px;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 20px;
    letter-spacing: 0.5px;
    transition: var(--transition);
  }
  .nav-auth-chip:not(.nav-auth-chip--connected):hover {
    background: rgba(255,255,255,0.1);
  }

  nav.scrolled .nav-auth-chip:not(.nav-auth-chip--connected) {
    color: var(--gris-texte);
    border-color: var(--gris-moyen);
  }
  nav.scrolled .nav-auth-chip:not(.nav-auth-chip--connected):hover {
    background: var(--gris-clair);
  }

  .nav-auth-name {
    color: rgba(255,255,255,0.85);
    font-weight: 500;
  }

  nav.scrolled .nav-auth-name {
    color: var(--gris-texte);
  }

  .nav-auth-role {
    font-weight: 300;
    opacity: 0.6;
    font-size: 11px;
  }

  .nav-auth-logout {
    background: none;
    border: 1px solid rgba(255,255,255,0.25);
    color: rgba(255,255,255,0.6);
    padding: 4px 10px;
    border-radius: 12px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 12px;
    cursor: pointer;
    transition: var(--transition);
  }
  .nav-auth-logout:hover {
    background: rgba(255,255,255,0.1);
    color: white;
  }

  nav.scrolled .nav-auth-logout {
    border-color: var(--gris-moyen);
    color: var(--gris-texte);
  }
  nav.scrolled .nav-auth-logout:hover {
    background: var(--gris-clair);
  }
  ```

---

- [ ] **Étape 4 : Vérification manuelle (console navigateur)**

  Ouvre `index.html` en local (`http://localhost:5501`). Dans la console :

  ```javascript
  await Auth.getUser()    // doit retourner null (non connecté)
  await Auth.getRole()    // doit retourner null
  Auth.hasRole('admin', 'membre')  // doit retourner true
  Auth.hasRole('etudiant', 'admin') // doit retourner false
  ```

  Résultat attendu : pas d'erreur, `hasRole` retourne les bons booléens.

---

- [ ] **Étape 5 : Commit**

  ```bash
  git add js/supabase-config.js js/auth.js css/style.css
  git commit -m "feat: auth.js module + nav chip + supabase-config"
  git push
  ```

---

## Task 3 : `connexion.html` — Connexion / Inscription / Reset

**Files:**
- Create: `connexion.html`

**Interfaces:**
- Consomme : `Auth.sb` (client Supabase), `Auth.getUser()`, `Auth.getProfil()`
- Produit : session Supabase stockée dans localStorage, profil créé via trigger

---

- [ ] **Étape 1 : Créer `connexion.html`**

  ```html
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Connexion — BDE CREAD Lyon</title>
    <link rel="stylesheet" href="css/style.css?v=7">
    <link rel="icon" type="image/png" href="assets/Logo.png?v=2">
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-C8REVEGYYL"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-C8REVEGYYL');</script>
    <style>
      body { background: var(--gris-clair); min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }

      .auth-card {
        background: white;
        border-radius: 20px;
        padding: 40px 36px;
        width: 100%;
        max-width: 440px;
        box-shadow: 0 4px 32px rgba(70,58,144,0.08);
      }

      .auth-logo {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 28px;
      }
      .auth-logo img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
      .auth-logo-text { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--violet); }

      .auth-tabs { display: flex; border-bottom: 2px solid var(--gris-clair); margin-bottom: 28px; }
      .auth-tab {
        flex: 1;
        padding: 10px;
        text-align: center;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 14px;
        letter-spacing: 0.5px;
        color: var(--gris-texte);
        cursor: pointer;
        border: none;
        background: none;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
        transition: var(--transition);
        text-transform: uppercase;
      }
      .auth-tab.active { color: var(--violet); border-bottom-color: var(--violet); font-weight: 600; }

      .auth-panel { display: none; }
      .auth-panel.active { display: block; }

      .auth-field { margin-bottom: 16px; }
      .auth-field label { display: block; font-size: 12px; font-family: 'Barlow Condensed', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gris-texte); margin-bottom: 6px; }
      .auth-field input,
      .auth-field select {
        width: 100%;
        padding: 10px 14px;
        border: 1.5px solid var(--gris-moyen);
        border-radius: 10px;
        font-family: 'Barlow', sans-serif;
        font-size: 14px;
        color: var(--noir);
        background: white;
        transition: var(--transition);
        outline: none;
      }
      .auth-field input:focus,
      .auth-field select:focus { border-color: var(--violet); }

      .auth-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

      .auth-avatar-wrap { display: flex; align-items: center; gap: 14px; }
      .auth-avatar-preview {
        width: 56px; height: 56px; border-radius: 50%;
        object-fit: cover; border: 2px solid var(--gris-moyen);
        background: var(--gris-clair); flex-shrink: 0;
      }
      .auth-avatar-btn {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 13px; letter-spacing: 0.3px;
        color: var(--violet); background: none;
        border: 1.5px solid var(--violet); border-radius: 8px;
        padding: 7px 14px; cursor: pointer;
        transition: var(--transition);
      }
      .auth-avatar-btn:hover { background: rgba(70,58,144,0.06); }

      .auth-btn {
        width: 100%;
        padding: 12px;
        background: var(--gradient);
        border: none;
        border-radius: 12px;
        color: white;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 1px;
        text-transform: uppercase;
        cursor: pointer;
        transition: var(--transition);
        margin-top: 4px;
      }
      .auth-btn:hover { opacity: 0.9; }
      .auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .auth-msg {
        margin-top: 14px;
        padding: 12px 14px;
        border-radius: 10px;
        font-size: 13px;
        display: none;
      }
      .auth-msg.error { background: #FFF0F0; color: #C0392B; border: 1px solid #F5C0C0; }
      .auth-msg.success { background: #F0FFF4; color: #1A7A40; border: 1px solid #B0E8C4; }
      .auth-msg.visible { display: block; }

      .auth-divider { text-align: center; font-size: 12px; color: var(--gris-moyen); margin: 8px 0 14px; }

      .auth-link { font-size: 13px; color: var(--violet); cursor: pointer; background: none; border: none; text-decoration: underline; padding: 0; }

      .auth-success-screen { text-align: center; padding: 20px 0; }
      .auth-success-screen .big-check { font-size: 48px; margin-bottom: 12px; }
      .auth-success-screen h2 { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; color: var(--violet); margin-bottom: 8px; }
      .auth-success-screen p { font-size: 14px; color: var(--gris-texte); line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="auth-card">
      <div class="auth-logo">
        <img src="assets/Logo.png" alt="BDE CREAD">
        <span class="auth-logo-text">BDE CREAD Lyon</span>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab active" onclick="showTab('connexion')">Connexion</button>
        <button class="auth-tab" onclick="showTab('inscription')">Inscription</button>
        <button class="auth-tab" onclick="showTab('reset')">Mot de passe</button>
      </div>

      <!-- CONNEXION -->
      <div id="panel-connexion" class="auth-panel active">
        <div class="auth-field">
          <label>Email</label>
          <input type="email" id="login-email" placeholder="ton@email.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label>Mot de passe</label>
          <input type="password" id="login-pwd" placeholder="••••••••" autocomplete="current-password">
        </div>
        <button class="auth-btn" onclick="doLogin()">Se connecter</button>
        <div class="auth-divider">ou</div>
        <div style="text-align:center;">
          <button class="auth-link" onclick="showTab('reset')">Mot de passe oublié ?</button>
        </div>
        <div id="login-msg" class="auth-msg"></div>
      </div>

      <!-- INSCRIPTION -->
      <div id="panel-inscription" class="auth-panel">
        <div class="auth-row">
          <div class="auth-field">
            <label>Prénom *</label>
            <input type="text" id="reg-prenom" placeholder="Marie" autocomplete="given-name">
          </div>
          <div class="auth-field">
            <label>Nom *</label>
            <input type="text" id="reg-nom" placeholder="Dupont" autocomplete="family-name">
          </div>
        </div>
        <div class="auth-field">
          <label>Email *</label>
          <input type="email" id="reg-email" placeholder="ton@email.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label>Mot de passe * (min. 8 caractères)</label>
          <input type="password" id="reg-pwd" placeholder="••••••••" autocomplete="new-password">
        </div>
        <div class="auth-row">
          <div class="auth-field">
            <label>Année d'étude *</label>
            <select id="reg-annee">
              <option value="1ère">1ère année</option>
              <option value="2ème">2ème année</option>
              <option value="3ème">3ème année</option>
              <option value="4ème">4ème année</option>
              <option value="5ème">5ème année</option>
            </select>
          </div>
          <div class="auth-field">
            <label>Téléphone (optionnel)</label>
            <input type="tel" id="reg-tel" placeholder="06 xx xx xx xx" autocomplete="tel">
          </div>
        </div>
        <!-- Photo de profil : disponible après connexion (bloc 1 — "Mon profil") -->
        <button class="auth-btn" onclick="doSignup()">Créer mon compte</button>
        <div id="reg-msg" class="auth-msg"></div>
      </div>

      <!-- SUCCESS après inscription -->
      <div id="panel-success" class="auth-panel">
        <div class="auth-success-screen">
          <div class="big-check">✅</div>
          <h2>Compte créé !</h2>
          <p>Un email de confirmation a été envoyé à <strong id="reg-email-confirm"></strong>.<br>Clique sur le lien dans l'email pour activer ton compte.</p>
          <p style="margin-top:14px;font-size:12px;color:var(--gris-moyen);">Tu peux fermer cette page.</p>
        </div>
      </div>

      <!-- RESET MOT DE PASSE -->
      <div id="panel-reset" class="auth-panel">
        <div class="auth-field">
          <label>Ton email</label>
          <input type="email" id="reset-email" placeholder="ton@email.com" autocomplete="email">
        </div>
        <button class="auth-btn" onclick="doReset()">Envoyer le lien de réinitialisation</button>
        <div id="reset-msg" class="auth-msg"></div>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
    <script src="js/supabase-config.js"></script>
    <script>
      const { createClient } = supabase;
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

      // Rediriger si déjà connecté
      sb.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          const next = new URLSearchParams(window.location.search).get('next') || '/';
          window.location.href = next;
        }
      });

      // Tabs
      function showTab(name) {
        ['connexion','inscription','reset','success'].forEach(t => {
          const panel = document.getElementById('panel-' + t);
          if (panel) panel.classList.remove('active');
        });
        document.querySelectorAll('.auth-tab').forEach((tab, i) => {
          tab.classList.remove('active');
          if (['connexion','inscription','reset'][i] === name) tab.classList.add('active');
        });
        const target = document.getElementById('panel-' + name);
        if (target) target.classList.add('active');
      }

      function showMsg(id, text, type) {
        const el = document.getElementById(id);
        el.textContent = text;
        el.className = 'auth-msg ' + type + ' visible';
      }
      function hideMsg(id) {
        document.getElementById(id).className = 'auth-msg';
      }

      // Aperçu avatar
      function previewAvatar(input) {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert('La photo ne doit pas dépasser 2 Mo.');
          input.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = e => { document.getElementById('avatar-preview').src = e.target.result; };
        reader.readAsDataURL(file);
      }

      // Connexion
      async function doLogin() {
        hideMsg('login-msg');
        const email = document.getElementById('login-email').value.trim();
        const pwd   = document.getElementById('login-pwd').value;
        if (!email || !pwd) { showMsg('login-msg', 'Remplis tous les champs.', 'error'); return; }

        const btn = document.querySelector('#panel-connexion .auth-btn');
        btn.disabled = true; btn.textContent = 'Connexion…';

        const { error } = await sb.auth.signInWithPassword({ email, password: pwd });
        btn.disabled = false; btn.textContent = 'Se connecter';

        if (error) {
          showMsg('login-msg', error.message === 'Invalid login credentials'
            ? 'Email ou mot de passe incorrect.'
            : error.message, 'error');
          return;
        }
        const next = new URLSearchParams(window.location.search).get('next') || '/';
        window.location.href = next;
      }

      // Inscription
      // Note : Supabase ne crée pas de session avant confirmation email.
      // telephone est donc passé via raw_user_meta_data et inséré par le trigger.
      // La photo de profil est disponible après connexion (bloc 1 — Mon profil).
      async function doSignup() {
        hideMsg('reg-msg');
        const prenom = document.getElementById('reg-prenom').value.trim();
        const nom    = document.getElementById('reg-nom').value.trim();
        const email  = document.getElementById('reg-email').value.trim();
        const pwd    = document.getElementById('reg-pwd').value;
        const annee  = document.getElementById('reg-annee').value;
        const tel    = document.getElementById('reg-tel').value.trim();

        if (!prenom || !nom || !email || !pwd || !annee) {
          showMsg('reg-msg', 'Remplis tous les champs obligatoires (*).', 'error');
          return;
        }

        const btn = document.querySelector('#panel-inscription .auth-btn');
        btn.disabled = true; btn.textContent = 'Création…';

        // Le trigger handle_new_user() lit prenom, nom, annee, telephone depuis
        // raw_user_meta_data et les insère dans profils — pas besoin d'update séparé.
        const { error } = await sb.auth.signUp({
          email,
          password: pwd,
          options: {
            data: { prenom, nom, annee, telephone: tel || null }
          }
        });

        btn.disabled = false; btn.textContent = 'Créer mon compte';

        if (error) {
          showMsg('reg-msg', error.message, 'error');
          return;
        }

        // Afficher l'écran de succès
        document.getElementById('reg-email-confirm').textContent = email;
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-success').classList.add('active');

        // Demander la permission OneSignal (si disponible)
        if (window.OneSignalDeferred) {
          OneSignalDeferred.push(async (OS) => {
            await OS.User.PushSubscription.optIn();
          });
        }
      }

      // Reset mot de passe
      async function doReset() {
        hideMsg('reset-msg');
        const email = document.getElementById('reset-email').value.trim();
        if (!email) { showMsg('reset-msg', 'Saisis ton email.', 'error'); return; }

        const btn = document.querySelector('#panel-reset .auth-btn');
        btn.disabled = true; btn.textContent = 'Envoi…';

        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://bdecreadien.fr/connexion.html'
        });

        btn.disabled = false; btn.textContent = 'Envoyer le lien de réinitialisation';
        if (error) { showMsg('reset-msg', error.message, 'error'); return; }
        showMsg('reset-msg', 'Email envoyé ! Vérifie ta boîte de réception.', 'success');
      }

      // Soumettre avec Entrée
      document.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const active = document.querySelector('.auth-panel.active');
        if (!active) return;
        const id = active.id;
        if (id === 'panel-connexion') doLogin();
        else if (id === 'panel-inscription') doSignup();
        else if (id === 'panel-reset') doReset();
      });
    </script>
  </body>
  </html>
  ```

---

- [ ] **Étape 2 : Test manuel — inscription**

  Ouvre `http://localhost:5501/connexion.html`. Onglet "Inscription" :
  - Remplis tous les champs.
  - Clique "Créer mon compte".
  - Résultat attendu : écran vert "Compte créé !".
  - Dans Supabase → Table Editor → `profils` : une ligne doit exister avec `prenom`, `nom`, `annee` et `role = etudiant`.

---

- [ ] **Étape 3 : Test manuel — connexion**

  Confirme l'email reçu (clique le lien). Retourne sur `connexion.html`, onglet "Connexion", saisis les identifiants.
  Résultat attendu : redirection vers `/`.

---

- [ ] **Étape 4 : Test manuel — mauvais mot de passe**

  Saisis un mauvais mot de passe. Résultat attendu : message rouge "Email ou mot de passe incorrect."

---

- [ ] **Étape 5 : Commit**

  ```bash
  git add connexion.html
  git commit -m "feat: connexion.html — inscription / login / reset"
  git push
  ```

---

## Task 4 : Ajout des scripts auth sur les pages existantes

**Files:**
- Modify: `index.html`, `agenda.html`, `annonces.html`, `communication.html`, `partenaires.html`, `contact.html`

**Interfaces:**
- Consomme : `js/supabase-config.js`, `js/auth.js` (chargés dans cet ordre)
- Produit : nav chip visible sur toutes les pages publiques.

---

- [ ] **Étape 1 : Ajouter les balises script dans `index.html`**

  Juste avant la balise `</body>` de chaque page, ajoute (après le `<script src="js/main.js">` existant) :

  ```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script src="js/supabase-config.js"></script>
  <script src="js/auth.js"></script>
  ```

---

- [ ] **Étape 2 : Répéter pour `agenda.html`**

  Même ajout que l'étape 1.

---

- [ ] **Étape 3 : Répéter pour `annonces.html`**

  Même ajout que l'étape 1.

---

- [ ] **Étape 4 : Répéter pour `communication.html`**

  Même ajout que l'étape 1.

---

- [ ] **Étape 5 : Répéter pour `partenaires.html`**

  Même ajout que l'étape 1.

---

- [ ] **Étape 6 : Répéter pour `contact.html`**

  Même ajout que l'étape 1.

---

- [ ] **Étape 7 : Test manuel nav chip**

  Ouvre `http://localhost:5501/index.html` sans être connecté.
  Résultat attendu : un lien "Connexion" apparaît dans la nav à droite.

  Connecte-toi via `connexion.html`, reviens sur `index.html`.
  Résultat attendu : chip "Prénom Étudiant | Déconnexion" dans la nav.

---

- [ ] **Étape 8 : Commit**

  ```bash
  git add index.html agenda.html annonces.html communication.html partenaires.html contact.html
  git commit -m "feat: scripts auth + nav chip sur toutes les pages publiques"
  git push
  ```

---

## Task 5 : `admin-utilisateurs.html` — Gestion des rôles

**Files:**
- Create: `admin-utilisateurs.html`

**Interfaces:**
- Consomme : `Auth.requireRole('admin')`, `Auth.sb`
- Produit : interface pour changer les rôles, visible uniquement aux admins.

---

- [ ] **Étape 1 : Créer `admin-utilisateurs.html`**

  ```html
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestion des membres — BDE CREAD Lyon</title>
    <link rel="stylesheet" href="css/style.css?v=7">
    <link rel="icon" type="image/png" href="assets/Logo.png?v=2">
    <style>
      body { background: var(--gris-clair); min-height: 100vh; font-family: 'Barlow', sans-serif; }

      .admin-wrap { max-width: 900px; margin: 0 auto; padding: 100px 24px 48px; }

      .admin-header { margin-bottom: 28px; }
      .admin-header h1 { font-family: 'Bebas Neue', sans-serif; font-size: 36px; color: var(--violet); letter-spacing: 1px; }
      .admin-header p { font-size: 14px; color: var(--gris-texte); margin-top: 4px; }

      .admin-toolbar {
        display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
      }
      .admin-search {
        flex: 1; min-width: 200px;
        padding: 9px 14px;
        border: 1.5px solid var(--gris-moyen);
        border-radius: 10px;
        font-family: 'Barlow', sans-serif;
        font-size: 14px;
        outline: none;
      }
      .admin-search:focus { border-color: var(--violet); }
      .admin-filter {
        padding: 9px 14px;
        border: 1.5px solid var(--gris-moyen);
        border-radius: 10px;
        font-family: 'Barlow', sans-serif;
        font-size: 14px;
        color: var(--noir);
        background: white;
        outline: none;
        cursor: pointer;
      }
      .admin-filter:focus { border-color: var(--violet); }

      .admin-table-wrap { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(70,58,144,0.07); }

      table { width: 100%; border-collapse: collapse; }
      thead { background: var(--gris-clair); }
      th {
        padding: 12px 16px;
        text-align: left;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--gris-texte);
        font-weight: 600;
      }
      td { padding: 12px 16px; border-top: 1px solid var(--gris-clair); font-size: 14px; }

      .user-avatar {
        width: 34px; height: 34px; border-radius: 50%;
        object-fit: cover; border: 1.5px solid var(--gris-moyen);
        vertical-align: middle; margin-right: 10px;
      }

      .role-badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-family: 'Barlow Condensed', sans-serif;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .role-badge.etudiant     { background: #EEF0FF; color: var(--violet); }
      .role-badge.membre       { background: #FFF0E8; color: var(--orange); }
      .role-badge.responsable  { background: #E8F4E8; color: #2A7A3A; }
      .role-badge.admin        { background: #1A1A2E; color: white; }

      .role-select {
        padding: 5px 10px;
        border: 1.5px solid var(--gris-moyen);
        border-radius: 8px;
        font-family: 'Barlow', sans-serif;
        font-size: 13px;
        cursor: pointer;
        outline: none;
      }
      .role-select:focus { border-color: var(--violet); }

      .save-btn {
        padding: 5px 14px;
        background: var(--violet);
        color: white;
        border: none;
        border-radius: 8px;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 13px;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: var(--transition);
      }
      .save-btn:hover { opacity: 0.85; }
      .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .admin-empty { text-align: center; padding: 40px; color: var(--gris-texte); font-size: 14px; }
      .admin-count { font-size: 13px; color: var(--gris-texte); margin-bottom: 12px; }
    </style>
  </head>
  <body>
    <nav id="navbar">
      <a href="index.html" class="nav-logo">
        <img src="assets/Logo.png" alt="Logo BDE CREAD Lyon" width="44" height="44" style="border-radius:50%;object-fit:cover;">
        <div class="nav-logo-text"><span class="bde">BDE LYON</span><span class="cread">CREAD</span></div>
      </a>
      <ul class="nav-links">
        <li><a href="index.html">Accueil</a></li>
        <li><a href="admin-utilisateurs.html" aria-current="page">Membres</a></li>
      </ul>
    </nav>

    <div class="admin-wrap">
      <div class="admin-header">
        <h1>Gestion des membres</h1>
        <p>Modifie le rôle d'un utilisateur. Les changements prennent effet à la prochaine connexion.</p>
      </div>

      <div class="admin-toolbar">
        <input class="admin-search" id="search" type="search" placeholder="Rechercher par nom, email…" oninput="filterTable()">
        <select class="admin-filter" id="filter-role" onchange="filterTable()">
          <option value="">Tous les rôles</option>
          <option value="etudiant">Étudiant</option>
          <option value="membre">Membre BDE</option>
          <option value="responsable">Responsable</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <p class="admin-count" id="count"></p>

      <div class="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Année</th>
              <th>Rôle actuel</th>
              <th>Nouveau rôle</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tbody">
            <tr><td colspan="5" class="admin-empty">Chargement…</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
    <script src="js/supabase-config.js"></script>
    <script src="js/auth.js"></script>
    <script>
      let allUsers = [];

      async function init() {
        const ok = await Auth.requireRole('admin');
        if (!ok) return;

        const { data, error } = await Auth.sb
          .from('profils')
          .select('id, prenom, nom, email, annee, role, avatar_url')
          .order('created_at', { ascending: true });

        if (error) {
          document.getElementById('tbody').innerHTML =
            '<tr><td colspan="5" class="admin-empty">Erreur de chargement.</td></tr>';
          return;
        }

        allUsers = data;
        renderTable(allUsers);
      }

      function renderTable(users) {
        document.getElementById('count').textContent = users.length + ' utilisateur(s)';
        const tbody = document.getElementById('tbody');
        if (!users.length) {
          tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Aucun résultat.</td></tr>';
          return;
        }
        tbody.innerHTML = users.map(u => `
          <tr data-id="${u.id}">
            <td>
              <img class="user-avatar" src="${u.avatar_url || 'assets/Logo.png'}" alt="">
              <strong>${u.prenom} ${u.nom}</strong><br>
              <span style="font-size:12px;color:var(--gris-texte)">${u.email}</span>
            </td>
            <td>${u.annee || '—'}</td>
            <td><span class="role-badge ${u.role}">${labelRole(u.role)}</span></td>
            <td>
              <select class="role-select" data-original="${u.role}" onchange="markDirty(this)">
                <option value="etudiant" ${u.role==='etudiant'?'selected':''}>Étudiant</option>
                <option value="membre" ${u.role==='membre'?'selected':''}>Membre BDE</option>
                <option value="responsable" ${u.role==='responsable'?'selected':''}>Responsable</option>
                <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
              </select>
            </td>
            <td>
              <button class="save-btn" data-id="${u.id}" onclick="saveRole(this)" disabled>Sauvegarder</button>
            </td>
          </tr>
        `).join('');
      }

      function labelRole(r) {
        return { etudiant:'Étudiant', membre:'Membre BDE', responsable:'Responsable', admin:'Admin' }[r] ?? r;
      }

      function markDirty(sel) {
        const row = sel.closest('tr');
        const btn = row.querySelector('.save-btn');
        btn.disabled = sel.value === sel.dataset.original;
      }

      async function saveRole(btn) {
        const id    = btn.dataset.id;
        const row   = btn.closest('tr');
        const sel   = row.querySelector('.role-select');
        const role  = sel.value;
        btn.disabled = true; btn.textContent = '…';

        const { error } = await Auth.sb
          .from('profils')
          .update({ role })
          .eq('id', id);

        if (error) {
          btn.textContent = 'Erreur';
          setTimeout(() => { btn.textContent = 'Sauvegarder'; btn.disabled = false; }, 2000);
          return;
        }

        sel.dataset.original = role;
        btn.textContent = '✓';
        row.querySelector('.role-badge').className = 'role-badge ' + role;
        row.querySelector('.role-badge').textContent = labelRole(role);
        setTimeout(() => { btn.textContent = 'Sauvegarder'; }, 1500);

        // Mettre à jour allUsers
        const u = allUsers.find(x => x.id === id);
        if (u) u.role = role;
      }

      function filterTable() {
        const q    = document.getElementById('search').value.toLowerCase();
        const role = document.getElementById('filter-role').value;
        const filtered = allUsers.filter(u => {
          const matchQ    = !q || (u.prenom + ' ' + u.nom + ' ' + u.email).toLowerCase().includes(q);
          const matchRole = !role || u.role === role;
          return matchQ && matchRole;
        });
        renderTable(filtered);
      }

      init();
    </script>
  </body>
  </html>
  ```

---

- [ ] **Étape 2 : Bootstrap admin — se promouvoir admin (manuel, une seule fois)**

  Dans Supabase → **Table Editor → profils** → trouve ta ligne → change le champ `role` de `etudiant` à `admin` → Save.

---

- [ ] **Étape 3 : Test manuel — accès admin**

  Connecté avec ton compte (maintenant `admin`), ouvre `http://localhost:5501/admin-utilisateurs.html`.
  Résultat attendu : la liste de tous les utilisateurs s'affiche.

---

- [ ] **Étape 4 : Test manuel — blocage non-admin**

  Ouvre `admin-utilisateurs.html` dans un onglet privé (non connecté).
  Résultat attendu : redirection automatique vers `connexion.html`.

---

- [ ] **Étape 5 : Test manuel — changement de rôle**

  Sélectionne un utilisateur de test, change son rôle en `membre`, clique "Sauvegarder".
  Résultat attendu : badge mis à jour, bouton affiche "✓", pas d'erreur.
  Vérification dans le Table Editor Supabase : la colonne `role` a bien changé.

---

- [ ] **Étape 6 : Commit**

  ```bash
  git add admin-utilisateurs.html
  git commit -m "feat: admin-utilisateurs.html — gestion des rôles"
  git push
  ```

---

## Task 6 : OneSignal — enregistrement du player ID à la connexion

**Files:**
- Modify: `js/auth.js`

**Interfaces:**
- Consomme : `window.OneSignalDeferred` (SDK OneSignal existant), `Auth.sb`
- Produit : `profils.onesignal_id` mis à jour à chaque connexion.

---

- [ ] **Étape 1 : Ajouter la logique OneSignal dans `js/auth.js`**

  Dans `js/auth.js`, après la définition de `initNavChip`, ajoute la fonction suivante **avant** `window.Auth = ...` :

  ```javascript
  // Enregistre l'ID OneSignal de l'appareil courant dans profils
  async function syncOneSignalId() {
    if (!window.OneSignalDeferred) return;
    const user = await getUser();
    if (!user) return;

    OneSignalDeferred.push(async (OS) => {
      const playerId = await OS.User.PushSubscription.id;
      if (!playerId) return;
      await sb.from('profils')
        .update({ onesignal_id: playerId })
        .eq('id', user.id);
    });
  }
  ```

  Puis dans `document.addEventListener('DOMContentLoaded', ...)`, ajoute l'appel :

  ```javascript
  document.addEventListener('DOMContentLoaded', () => {
    initNavChip();
    syncOneSignalId();
  });
  ```

---

- [ ] **Étape 2 : Trouver l'App ID OneSignal (manuel)**

  Va sur [onesignal.com](https://onesignal.com) → ton app `bdecreadien` → **Settings → Keys & IDs**.
  Note l'**App ID** (UUID).

  Dans `index.html` (et toutes les pages publiques), vérifie que le script OneSignal est chargé avec ton App ID. Si ce n'est pas le cas, ajoute dans le `<head>` :

  ```html
  <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
  <script>
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    OneSignalDeferred.push(async function(OneSignal) {
      await OneSignal.init({ appId: "TON_APP_ID_ONESIGNAL" });
    });
  </script>
  ```

---

- [ ] **Étape 3 : Test manuel — synchronisation OneSignal**

  Connecte-toi sur le site (sur Chrome avec les notifications autorisées).
  Vérifie dans Supabase → Table Editor → `profils` → ta ligne : le champ `onesignal_id` doit être rempli avec un UUID.

---

- [ ] **Étape 4 : Commit**

  ```bash
  git add js/auth.js index.html agenda.html annonces.html communication.html partenaires.html contact.html
  git commit -m "feat: sync onesignal_id sur profil à la connexion"
  git push
  ```

---

## Task 7 : Vérification RLS — test de sécurité

**Files:** Aucun (tests dans le SQL Editor Supabase)

---

- [ ] **Test 1 : Étudiant ne peut pas lire le profil d'un autre**

  Dans Supabase → SQL Editor :
  ```sql
  -- Simule un étudiant (remplace UUID_ETUDIANT par l'ID d'un etudiant de test)
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub": "UUID_ETUDIANT", "role": "authenticated"}';
  select * from public.profils where id != 'UUID_ETUDIANT';
  ```
  Résultat attendu : `0 rows` (la RLS bloque).

---

- [ ] **Test 2 : Étudiant ne peut pas modifier son propre rôle**

  ```sql
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub": "UUID_ETUDIANT", "role": "authenticated"}';
  update public.profils set role = 'admin' where id = 'UUID_ETUDIANT';
  ```
  Résultat attendu : `ERROR: new row violates row-level security policy`.

---

- [ ] **Test 3 : Admin peut lire tous les profils**

  ```sql
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub": "UUID_ADMIN", "role": "authenticated"}';
  select count(*) from public.profils;
  ```
  Résultat attendu : nombre total d'utilisateurs (pas 0).

---

- [ ] **Test 4 : Admin peut changer le rôle d'un autre**

  ```sql
  set local role authenticated;
  set local "request.jwt.claims" = '{"sub": "UUID_ADMIN", "role": "authenticated"}';
  update public.profils set role = 'membre' where id = 'UUID_ETUDIANT';
  ```
  Résultat attendu : `UPDATE 1`.

---

- [ ] **Test 5 : requireRole en JS bloque la navigation**

  Dans la console navigateur, en étant connecté comme `etudiant` :
  ```javascript
  await Auth.requireRole('admin')
  ```
  Résultat attendu : redirection vers `connexion.html?next=...`.

---

- [ ] **Commit final + tag**

  ```bash
  git add .
  git commit -m "chore: bloc-0 fondation comptes + rôles — complet"
  git push
  ```

---

## Récapitulatif des fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/001_profils.sql` | Schéma complet : table, trigger, RLS |
| `js/supabase-config.js` | URL + clé anon |
| `js/auth.js` | Module partagé : session, rôles, nav chip, OneSignal |
| `connexion.html` | Inscription / Connexion / Reset |
| `admin-utilisateurs.html` | Gestion des rôles (admin) |
| `index.html` … `contact.html` | Scripts auth ajoutés |
| `css/style.css` | Styles nav chip |
