-- Migration 041 — Admin peut supprimer une demande d'adhésion BDE
-- ============================================================================
drop policy if exists "demandes_delete_admin" on public.demandes_membre_bde;
create policy "demandes_delete_admin" on public.demandes_membre_bde for delete
  using (mon_role() = 'admin');
