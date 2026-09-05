-- Migration 030 — Permet aux membres BDE de lire bde_config (pour utiliser le token GitHub)
--
-- Contexte : la migration 009 avait restreint SELECT à admin uniquement, pour éviter
-- qu'un membre exfiltre le token GitHub. Mais du coup les membres ne peuvent plus utiliser /admin.
--
-- Compromis : SELECT ouvert aux membres BDE (pour lire le token et éditer via /admin),
-- INSERT/UPDATE restent admin-only (seul l'admin peut changer le token).
-- Risque résiduel : un membre malveillant pourrait copier le token et l'utiliser hors du site.
-- Atténuation : token GitHub à scope minimal (juste "repo public"), rotation possible depuis /admin.

drop policy if exists "bde_config_select_admin" on public.bde_config;
drop policy if exists "bde_config_select_bde" on public.bde_config;

create policy "bde_config_select_membre" on public.bde_config for select
  using (mon_role() in ('membre', 'admin'));
