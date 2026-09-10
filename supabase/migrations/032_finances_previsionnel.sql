-- Migration 032 — Prévisionnel et validation des événements + solde initial
-- ============================================================================
-- Étend le suivi financier : gains prévus + coûts prévus + gains réels + coût réel + validation.
-- Le budget_previsionnel existant devient sémantiquement le "coût prévisionnel".

alter table public.evenements
  add column if not exists gains_previsionnel numeric(10,2),
  add column if not exists gains_reel numeric(10,2),
  add column if not exists valide boolean not null default false;

-- Solde initial du BDE (report d'exercice antérieur). Editable par bureau ou admin.
insert into public.bde_config (id, value)
values ('solde_initial', '954.32')
on conflict (id) do update set value = excluded.value, updated_at = now();

-- Autorise le bureau (rôle membre + bureau=true) et l'admin à mettre à jour
-- uniquement la clé solde_initial dans bde_config.
drop policy if exists "bde_config_update_solde" on public.bde_config;
create policy "bde_config_update_solde" on public.bde_config for update
  using (
    id = 'solde_initial'
    and (
      mon_role() = 'admin'
      or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
    )
  );

drop policy if exists "bde_config_insert_solde" on public.bde_config;
create policy "bde_config_insert_solde" on public.bde_config for insert
  with check (
    id = 'solde_initial'
    and (
      mon_role() = 'admin'
      or exists (select 1 from public.profils p where p.id = auth.uid() and p.bureau = true)
    )
  );
