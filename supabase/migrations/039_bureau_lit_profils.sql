-- Migration 039 — Bureau peut lire tous les profils (pour l'assignation de tâches)
-- ============================================================================
-- Sans cette policy, un membre BDE marqué "bureau=true" ne peut voir que son propre
-- profil, ce qui empêche de peupler la liste "Assigner à" dans Mon planning.

-- Réécrit est_bureau en SECURITY DEFINER pour éviter tout risque de récursion RLS
create or replace function public.est_bureau() returns boolean
language sql security definer stable as $$
  select coalesce(
    (select bureau from public.profils where id = auth.uid())
    or public.mon_role() = 'admin',
    false
  );
$$;

drop policy if exists "bureau lit tous les profils" on public.profils;
create policy "bureau lit tous les profils"
  on public.profils for select
  using (public.est_bureau());
