-- Migration 028 — Élargit le planning aux membres BDE (role in membre/admin)
-- Avant : seulement bureau=true. Après : tout membre BDE peut voir/s'inscrire.

-- taches_bureau
drop policy if exists "taches_bureau_select" on public.taches_bureau;
create policy "taches_bureau_select" on public.taches_bureau
  for select to authenticated
  using (public.mon_role() in ('membre', 'admin'));

drop policy if exists "taches_bureau_write" on public.taches_bureau;
create policy "taches_bureau_write" on public.taches_bureau
  for all to authenticated
  using (public.mon_role() in ('membre', 'admin'))
  with check (public.mon_role() in ('membre', 'admin'));

-- inscriptions_taches
drop policy if exists "inscriptions_taches_select" on public.inscriptions_taches;
create policy "inscriptions_taches_select" on public.inscriptions_taches
  for select to authenticated
  using (public.mon_role() in ('membre', 'admin'));

drop policy if exists "inscriptions_taches_insert" on public.inscriptions_taches;
create policy "inscriptions_taches_insert" on public.inscriptions_taches
  for insert to authenticated
  with check (
    (membre_id = auth.uid() or public.mon_role() = 'admin')
    and public.mon_role() in ('membre', 'admin')
  );

drop policy if exists "inscriptions_taches_delete" on public.inscriptions_taches;
create policy "inscriptions_taches_delete" on public.inscriptions_taches
  for delete to authenticated
  using (
    (membre_id = auth.uid() or public.mon_role() = 'admin')
    and public.mon_role() in ('membre', 'admin')
  );

-- templates_taches
drop policy if exists "templates_taches_select" on public.templates_taches;
create policy "templates_taches_select" on public.templates_taches
  for select to authenticated
  using (public.mon_role() in ('membre', 'admin'));

drop policy if exists "templates_taches_write" on public.templates_taches;
create policy "templates_taches_write" on public.templates_taches
  for all to authenticated
  using (public.mon_role() in ('membre', 'admin'))
  with check (public.mon_role() in ('membre', 'admin'));
