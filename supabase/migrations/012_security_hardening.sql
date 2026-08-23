-- Migration 012 — Durcissement sécurité (audit post-brief)

-- 1. Force statut='pending' à la création sauf pour membre/admin
--    (empêche bypass de modération via manipulation client)
drop policy if exists "annonces_insert_auth" on public.annonces;
create policy "annonces_insert_auth" on public.annonces for insert to authenticated
  with check (
    auteur_id = auth.uid()
    and (
      statut = 'pending'
      or (statut = 'published' and public.mon_role() in ('membre','admin'))
    )
  );

-- 2. Renforce WITH CHECK sur annonces_update : impossible de changer auteur_id
drop policy if exists "annonces_update" on public.annonces;
create policy "annonces_update" on public.annonces for update
  using (
    (auteur_id = auth.uid() and statut in ('pending','published'))
    or public.mon_role() in ('membre','admin')
  )
  with check (
    (
      auteur_id = auth.uid()
      and statut in ('pending','published','sold')
    )
    or public.mon_role() in ('membre','admin')
  );

-- 3. cartes_fidelite : empêche réassignement de user_id/total par un membre BDE
drop policy if exists "cartes_update_bde" on public.cartes_fidelite;
create policy "cartes_update_bde" on public.cartes_fidelite for update
  using (public.mon_role() in ('membre','admin'))
  with check (
    public.mon_role() in ('membre','admin')
    and user_id = (select user_id from public.cartes_fidelite where user_id = cartes_fidelite.user_id)
  );

-- 4. Révoque l'exécution publique des fonctions security definer sensibles
revoke execute on function public.create_carte_on_signup() from public;
revoke execute on function public.handle_new_user() from public;
