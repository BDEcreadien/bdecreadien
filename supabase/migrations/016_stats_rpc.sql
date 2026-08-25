-- Migration 016 — RPC agrégée pour le dashboard stats admin
create or replace function public.bde_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  -- Contrôle d'accès : réservé aux membres BDE et admins
  if public.mon_role() not in ('membre', 'admin') then
    raise exception 'Accès refusé';
  end if;

  select jsonb_build_object(
    'profils_total', (select count(*) from public.profils),
    'profils_7j', (select count(*) from public.profils where created_at > now() - interval '7 days'),
    'profils_30j', (select count(*) from public.profils where created_at > now() - interval '30 days'),
    'profils_etudiant', (select count(*) from public.profils where role = 'etudiant'),
    'profils_membre', (select count(*) from public.profils where role = 'membre'),
    'profils_admin', (select count(*) from public.profils where role = 'admin'),
    'annonces_pending', (select count(*) from public.annonces where statut = 'pending'),
    'annonces_published', (select count(*) from public.annonces where statut = 'published'),
    'annonces_sold', (select count(*) from public.annonces where statut = 'sold'),
    'cartes_total', (select count(*) from public.cartes_fidelite),
    'cartes_tampons', (select coalesce(sum(tampons), 0) from public.cartes_fidelite),
    'cartes_completes', (select count(*) from public.cartes_fidelite where tampons >= total),
    'feedbacks_pending', (select count(*) from public.feedbacks where statut in ('pending', 'new') or statut is null),
    'demandes_pending', (select count(*) from public.demandes_membre_bde where statut = 'pending'),
    'newsletter_active', (select count(*) from public.newsletter_subscribers where status = 'active'),
    'evenements_upcoming', (select count(*) from public.evenements where date > now())
  )
  into result;

  return result;
end;
$$;

revoke execute on function public.bde_stats() from public;
grant execute on function public.bde_stats() to authenticated;
