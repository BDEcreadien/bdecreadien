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
