-- Migration 037 — Sépare les events publics des events internes bureau
-- ============================================================================
-- Un event créé depuis /admin?page=planning (Planning bureau) est parfois interne :
-- setup, briefing, réunion préparation... et ne doit pas apparaître sur l'accueil
-- ni /agenda public. Un event créé depuis /admin?page=agenda reste public
-- ET visible dans Planning bureau pour organiser les tâches.

alter table public.evenements
  add column if not exists bureau_only boolean not null default false;

create index if not exists evenements_bureau_only_idx on public.evenements(bureau_only);
