-- Sécurisation de la boutique. A exécuter UNE FOIS dans Supabase > SQL Editor (peut être relancé sans risque).
-- Remplace migration_protect_commandes.sql (son contenu est inclus ici).
--
-- 1. Les articles et commandes déjà validés ne peuvent plus être supprimés.
-- 2. Un client ne peut plus se passer lui-même en "payée" ni faire reculer une commande validée.
--    (le serveur, la synchro HelloAsso et le bureau gardent tous leurs droits)
-- 3. Un numéro de commande, une fois attribué, ne change plus jamais.

-- ── 1. Pas de suppression des commandes validées ─────────────────────────────
create or replace function protect_boutique_items_delete() returns trigger as $$
begin
  if exists (
    select 1 from boutique_commandes c
    where c.id = old.commande_id and c.statut not in ('panier', 'en_attente')
  ) then
    raise exception 'Suppression interdite : article d''une commande validée (%)', old.commande_id;
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_boutique_items_delete on boutique_items;
create trigger trg_protect_boutique_items_delete
  before delete on boutique_items
  for each row execute function protect_boutique_items_delete();

create or replace function protect_boutique_commandes_delete() returns trigger as $$
begin
  if old.statut not in ('panier', 'en_attente') then
    raise exception 'Suppression interdite : commande validée (%)', old.numero;
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_protect_boutique_commandes_delete on boutique_commandes;
create trigger trg_protect_boutique_commandes_delete
  before delete on boutique_commandes
  for each row execute function protect_boutique_commandes_delete();

-- ── 2. Garde-fou sur les changements de statut faits depuis le navigateur ───
-- auth.uid() est null pour le serveur (clé service) : seuls les clients connectés
-- sans droit "bureau" sont limités à panier <-> en_attente.
create or replace function boutique_guard_statut() returns trigger as $$
begin
  if new.statut is distinct from old.statut
     and auth.uid() is not null
     and not exists (select 1 from profils where id = auth.uid() and bureau = true) then
    if new.statut not in ('panier', 'en_attente') then
      raise exception 'Changement de statut interdit';
    end if;
    if old.statut not in ('panier', 'en_attente') then
      raise exception 'Commande déjà validée : statut non modifiable';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_boutique_guard_statut on boutique_commandes;
create trigger trg_boutique_guard_statut
  before update on boutique_commandes
  for each row execute function boutique_guard_statut();

-- ── 3. Numéro stable : attribué une seule fois, jamais modifié ──────────────
create or replace function public.boutique_set_numero() returns trigger
language plpgsql as $$
begin
  if old.numero is not null then
    new.numero := old.numero;
  elsif new.statut <> 'panier' then
    new.numero := 'BDE-' || extract(year from now())::text || '-'
               || lpad(nextval('boutique_commande_seq')::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;
