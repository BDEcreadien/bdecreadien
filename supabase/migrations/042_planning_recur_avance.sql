-- Migration 042 — Types de récurrence avancés pour planning_taches_recurrentes
-- ============================================================================
-- Ajoute la possibilité de : intervalle (toutes les N semaines), jours ouvrés,
-- Nième jour du mois (2ème mardi), dernier jour du mois (dernier vendredi),
-- jour du mois (le 15 de chaque mois), tous les N jours.

alter table public.planning_taches_recurrentes
  add column if not exists type_recur text not null default 'hebdomadaire'
    check (type_recur in ('hebdomadaire','ouvre','quotidien','mensuel_dow','mensuel_dom')),
  add column if not exists intervalle int not null default 1
    check (intervalle >= 1 and intervalle <= 52),
  add column if not exists n_semaine_mois int
    check (n_semaine_mois is null or (n_semaine_mois between -1 and 5 and n_semaine_mois != 0)),
  add column if not exists jour_mois int
    check (jour_mois is null or (jour_mois between 1 and 31));

-- Relâche la contrainte jour_semaine pour permettre 0 (dimanche) et 7 (dimanche) en cas de besoin
-- + tolérer null pour les types qui n'utilisent pas jour_semaine (quotidien, mensuel_dom).
alter table public.planning_taches_recurrentes
  drop constraint if exists planning_taches_recurrentes_jour_semaine_check;
alter table public.planning_taches_recurrentes
  alter column jour_semaine drop not null;
alter table public.planning_taches_recurrentes
  add constraint planning_taches_recurrentes_jour_semaine_check
    check (jour_semaine is null or (jour_semaine between 1 and 7));
