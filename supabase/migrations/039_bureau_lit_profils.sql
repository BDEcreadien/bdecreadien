-- Migration 039 — Bureau peut lire tous les profils (pour l'assignation de tâches)
-- ============================================================================

drop policy if exists "bureau lit tous les profils" on public.profils;
create policy "bureau lit tous les profils"
  on public.profils for select
  using (
    exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
  );
