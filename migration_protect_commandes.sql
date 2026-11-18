-- Verrou : on ne supprime JAMAIS les articles ni les commandes déjà validées.
-- Seuls les paniers (panier) et commandes non payées (en_attente) restent supprimables
-- (modification de panier, nettoyage des doublons).
-- A exécuter une fois dans Supabase > SQL Editor.

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
