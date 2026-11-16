-- Migration 063 — Liens : droits d'écriture étendus à tous les membres BDE (pas bureau only)

-- SELECT : tous les membres voient tous les liens (actifs + inactifs)
drop policy if exists "liens_select_bureau" on public.liens;
create policy "liens_select_membres" on public.liens
  for select to authenticated
  using (
    public.mon_role() in ('membre', 'admin')
  );

-- INSERT/UPDATE/DELETE : tous les membres BDE (plus bureau uniquement)
drop policy if exists "liens_write_bureau" on public.liens;
create policy "liens_write_membres" on public.liens
  for all to authenticated
  using (
    public.mon_role() in ('membre', 'admin')
  )
  with check (
    public.mon_role() in ('membre', 'admin')
  );
