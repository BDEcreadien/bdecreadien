-- ============================================
-- Migration 009 — Fixes sécurité critiques
-- ============================================

-- 1. bde_config : restreindre lecture aux ADMINS uniquement
-- (contient le token GitHub — un membre BDE pouvait l'exfiltrer)
drop policy if exists "bde_config_select_bde" on public.bde_config;
create policy "bde_config_select_admin" on public.bde_config for select
  using (mon_role() = 'admin');

-- 2. profils : bloquer l'élévation de privilèges
-- (sans WITH CHECK, tout étudiant pouvait s'auto-promouvoir admin)
drop policy if exists "profils_update_own_or_admin" on public.profils;

create policy "profils_update_own" on public.profils for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.mon_role()
    and banni_jusqu_a is not distinct from (select banni_jusqu_a from public.profils where id = auth.uid())
  );

create policy "profils_update_admin" on public.profils for update
  using (mon_role() = 'admin')
  with check (mon_role() = 'admin');

-- 3. Storage bucket annonces : contrôle du propriétaire dans le path
drop policy if exists "annonces_upload_auth" on storage.objects;
create policy "annonces_upload_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'annonces'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
