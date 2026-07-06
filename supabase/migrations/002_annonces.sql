-- Table des annonces étudiants
create table if not exists public.annonces (
  id          uuid primary key default gen_random_uuid(),
  auteur_id   uuid references public.profils(id) on delete cascade not null,
  titre       text not null,
  description text not null,
  categorie   text not null check (categorie in ('materiel','place','logement','service','autre')),
  prix        text,
  contact     text,
  photo_url   text,
  statut      text not null default 'pending' check (statut in ('pending','published','rejected')),
  created_at  timestamptz default now()
);

-- Index pour les requêtes fréquentes
create index if not exists annonces_statut_idx on public.annonces(statut);
create index if not exists annonces_auteur_idx on public.annonces(auteur_id);

-- RLS
alter table public.annonces enable row level security;

-- Tout le monde peut voir les annonces publiées
create policy "annonces_select_published"
  on public.annonces for select
  using (statut = 'published' or auteur_id = auth.uid() or mon_role() in ('admin','responsable'));

-- Un étudiant connecté peut créer une annonce
create policy "annonces_insert_auth"
  on public.annonces for insert
  with check (auteur_id = auth.uid() and mon_role() is not null);

-- L'auteur peut modifier son annonce (si encore pending)
-- Les admins/responsables peuvent changer le statut
create policy "annonces_update"
  on public.annonces for update
  using (
    (auteur_id = auth.uid() and statut = 'pending')
    or mon_role() in ('admin','responsable')
  );

-- L'auteur ou un admin peut supprimer
create policy "annonces_delete"
  on public.annonces for delete
  using (auteur_id = auth.uid() or mon_role() in ('admin','responsable'));

-- Bucket storage annonces (à créer manuellement dans Supabase Storage)
-- Nom : annonces | Public : oui | Taille max fichier : 5 MB
