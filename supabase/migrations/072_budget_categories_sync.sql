-- Migration 072 — Budget catégories synchronisé via bde_config
-- Autorise le bureau à lire et écrire la clé budget_categories_v2

drop policy if exists "bde_config_update_budget_cat" on public.bde_config;
create policy "bde_config_update_budget_cat" on public.bde_config for update
  using (
    id = 'budget_categories_v2'
    and (
      mon_role() = 'admin'
      or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
    )
  );

drop policy if exists "bde_config_insert_budget_cat" on public.bde_config;
create policy "bde_config_insert_budget_cat" on public.bde_config for insert
  with check (
    id = 'budget_categories_v2'
    and (
      mon_role() = 'admin'
      or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
    )
  );
