-- Migration 031 — Renforce la sécurité des profils
-- Empêche un utilisateur de s'auto-promouvoir bureau (seul admin peut le toggle).

-- Recrée la policy update_own en ajoutant bureau au verrouillage
drop policy if exists "profils_update_own" on public.profils;
create policy "profils_update_own" on public.profils for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.mon_role()
    and bureau is not distinct from (select bureau from public.profils where id = auth.uid())
    and banni_jusqu_a is not distinct from (select banni_jusqu_a from public.profils where id = auth.uid())
  );

-- La policy profils_update_admin (mon_role = 'admin') reste inchangée : admin peut tout modifier.
