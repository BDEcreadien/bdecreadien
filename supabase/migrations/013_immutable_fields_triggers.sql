-- Migration 013 — Triggers OLD/NEW pour verrouiller les champs sensibles
-- (RLS ne peut pas comparer OLD vs NEW, donc on utilise des triggers)

-- 1. Bloque le changement de statut annonces vers 'published' pour les non-BDE
--    (empêche : créer en 'pending' puis UPDATE en 'published' pour contourner la modération)
create or replace function public.enforce_annonce_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Membres BDE et admins : liberté totale
  if public.mon_role() in ('membre','admin') then
    return new;
  end if;
  -- Auteur ne peut pas :
  --   - Changer l'auteur
  --   - Basculer une annonce en 'published' (seul le BDE peut valider)
  --   - Réactiver une annonce refusée
  if new.auteur_id is distinct from old.auteur_id then
    raise exception 'Modification de auteur_id interdite';
  end if;
  if old.statut = 'rejected' then
    raise exception 'Une annonce refusée ne peut pas être modifiée par l''auteur';
  end if;
  -- Autorise pending↔pending, published↔published, published→sold, pending→sold
  if new.statut not in ('pending','published','sold') then
    raise exception 'Statut invalide : %', new.statut;
  end if;
  if old.statut = 'pending' and new.statut = 'published' then
    raise exception 'Seul un membre BDE peut publier une annonce';
  end if;
  if old.statut = 'sold' and new.statut <> 'sold' then
    raise exception 'Une annonce vendue ne peut pas être réactivée';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_annonce_status on public.annonces;
create trigger trg_enforce_annonce_status
  before update on public.annonces
  for each row execute function public.enforce_annonce_status();

-- 2. Bloque la réassignement de user_id / total sur cartes_fidelite
--    (RLS with check ne peut pas comparer OLD.user_id vs NEW.user_id)
create or replace function public.enforce_carte_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id est immuable';
  end if;
  if new.total is distinct from old.total then
    raise exception 'total est immuable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_carte_immutable on public.cartes_fidelite;
create trigger trg_enforce_carte_immutable
  before update on public.cartes_fidelite
  for each row execute function public.enforce_carte_immutable();
