-- 071 : sécurité des rôles + droits d'accès aux modules de l'admin
--
-- 1. Verrou serveur : seuls les administrateurs peuvent changer `role` ou `bureau` d'un profil.
--    Avant, la politique « modification propre profil » ne contrôlait que `role` : un étudiant
--    connecté pouvait se mettre `bureau = true` depuis la console du navigateur.
--    auth.uid() est null pour le service role / l'éditeur SQL : ces accès restent autorisés.
-- 2. Table bde_acces : niveau minimum requis par module (membre / bureau / admin).
--    Lisible par les membres seulement (non publique), modifiable par les admins.
-- 3. bde_parametres (déjà en production) : définition versionnée ici.

create or replace function public.profils_protege_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.bureau is distinct from old.bureau)
     and auth.uid() is not null
     and coalesce(public.mon_role(), '') <> 'admin' then
    raise exception 'Seul un administrateur peut modifier le rôle ou l''appartenance au bureau';
  end if;
  return new;
end $$;

drop trigger if exists trg_profils_protege_role on public.profils;
create trigger trg_profils_protege_role
  before update on public.profils
  for each row execute function public.profils_protege_role();

-- Table des droits d'accès par module
create table if not exists public.bde_acces (
  module     text primary key,
  niveau     text not null check (niveau in ('membre', 'bureau', 'admin')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.bde_acces enable row level security;

drop policy if exists "bde_acces_select_membres" on public.bde_acces;
create policy "bde_acces_select_membres" on public.bde_acces for select
  using (public.mon_role() in ('membre', 'responsable', 'admin'));

drop policy if exists "bde_acces_write_admin" on public.bde_acces;
create policy "bde_acces_write_admin" on public.bde_acces for all
  using (public.mon_role() = 'admin') with check (public.mon_role() = 'admin');

-- Valeurs de départ = comportement actuel
insert into public.bde_acces (module, niveau) values
  ('contenu', 'membre'), ('newsletter', 'membre'), ('fidelite', 'membre'), ('stats', 'membre'),
  ('liens', 'membre'), ('qr', 'membre'),
  ('boutique', 'bureau'), ('billetterie', 'bureau'), ('finances', 'bureau'),
  ('facturation', 'bureau'), ('planning', 'bureau')
on conflict (module) do nothing;

-- bde_parametres (existe déjà en production)
create table if not exists public.bde_parametres (
  cle        text primary key,
  valeur     text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.bde_parametres enable row level security;
drop policy if exists "bde_parametres_select_all" on public.bde_parametres;
create policy "bde_parametres_select_all" on public.bde_parametres for select using (true);
drop policy if exists "bde_parametres_insert_admin" on public.bde_parametres;
create policy "bde_parametres_insert_admin" on public.bde_parametres for insert with check (public.mon_role() = 'admin');
drop policy if exists "bde_parametres_update_admin" on public.bde_parametres;
create policy "bde_parametres_update_admin" on public.bde_parametres for update using (public.mon_role() = 'admin');
drop policy if exists "bde_parametres_delete_admin" on public.bde_parametres;
create policy "bde_parametres_delete_admin" on public.bde_parametres for delete using (public.mon_role() = 'admin');
