-- Migration 027 — Planning bureau v2 : tâches + inscriptions + templates
-- Refonte complète : on abandonne dispos_bureau (statut global oui/peut-être/non)
-- pour un système de tâches multiples par event, avec inscription à la Google Forms.

-- ============================================================================
-- 1. Drop de l'ancienne table (statut global inutile)
-- ============================================================================
drop table if exists public.dispos_bureau cascade;

-- ============================================================================
-- 2. Colonne blocage_desinscription_h sur evenements
--    (nombre d'heures avant l'event où on ne peut plus se désinscrire ;
--     null = pas de blocage, 24 par défaut)
-- ============================================================================
alter table public.evenements
  add column if not exists blocage_desinscription_h integer default 24;

comment on column public.evenements.blocage_desinscription_h is
  'Heures avant début de l''event où la désinscription est bloquée. NULL = pas de blocage.';

-- ============================================================================
-- 3. Table taches_bureau : les tâches d'un event (bar, vestiaire, caisse…)
-- ============================================================================
create table if not exists public.taches_bureau (
  id            uuid primary key default gen_random_uuid(),
  evenement_id  uuid not null references public.evenements(id) on delete cascade,
  titre         text not null,
  description   text,
  capacite      integer,  -- null = illimité
  ordre         integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_taches_bureau_event on public.taches_bureau (evenement_id, ordre);

alter table public.taches_bureau enable row level security;

-- SELECT : tout membre du bureau voit toutes les tâches
drop policy if exists "taches_bureau_select" on public.taches_bureau;
create policy "taches_bureau_select" on public.taches_bureau
  for select to authenticated
  using (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

-- INSERT/UPDATE/DELETE : bureau uniquement (tous peuvent créer/gérer les tâches)
drop policy if exists "taches_bureau_write" on public.taches_bureau;
create policy "taches_bureau_write" on public.taches_bureau
  for all to authenticated
  using (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  )
  with check (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

drop trigger if exists trg_touch_taches_bureau on public.taches_bureau;
create trigger trg_touch_taches_bureau
  before update on public.taches_bureau
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 4. Table inscriptions_taches : qui s'inscrit sur quelle tâche
-- ============================================================================
create table if not exists public.inscriptions_taches (
  id          uuid primary key default gen_random_uuid(),
  tache_id    uuid not null references public.taches_bureau(id) on delete cascade,
  membre_id   uuid not null references public.profils(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (tache_id, membre_id)  -- empêche double inscription
);

create index if not exists idx_inscriptions_taches_tache on public.inscriptions_taches (tache_id);
create index if not exists idx_inscriptions_taches_membre on public.inscriptions_taches (membre_id);

alter table public.inscriptions_taches enable row level security;

-- SELECT : tout membre bureau voit toutes les inscriptions
drop policy if exists "inscriptions_taches_select" on public.inscriptions_taches;
create policy "inscriptions_taches_select" on public.inscriptions_taches
  for select to authenticated
  using (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

-- INSERT : un membre ne peut inscrire QUE lui-même (sauf admin)
drop policy if exists "inscriptions_taches_insert" on public.inscriptions_taches;
create policy "inscriptions_taches_insert" on public.inscriptions_taches
  for insert to authenticated
  with check (
    (membre_id = auth.uid() or public.mon_role() = 'admin')
    and (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

-- DELETE : un membre peut se désinscrire soi-même, ou admin peut nettoyer
--          (le contrôle du blocage 24h se fait côté client + trigger ci-dessous)
drop policy if exists "inscriptions_taches_delete" on public.inscriptions_taches;
create policy "inscriptions_taches_delete" on public.inscriptions_taches
  for delete to authenticated
  using (
    (membre_id = auth.uid() or public.mon_role() = 'admin')
    and (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

-- ============================================================================
-- 5. Trigger de validation : capacité + blocage désinscription
-- ============================================================================

-- Vérifie la capacité à l'insertion
create or replace function public.check_capacite_tache()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacite integer;
  v_count    integer;
begin
  select capacite into v_capacite from public.taches_bureau where id = new.tache_id;
  if v_capacite is null then
    return new;  -- illimité
  end if;
  select count(*) into v_count from public.inscriptions_taches where tache_id = new.tache_id;
  if v_count >= v_capacite then
    raise exception 'Capacité maximale atteinte (% places)', v_capacite
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_capacite on public.inscriptions_taches;
create trigger trg_check_capacite
  before insert on public.inscriptions_taches
  for each row execute function public.check_capacite_tache();

-- Vérifie le blocage désinscription (24h par défaut avant l'event)
-- Admin bypass le blocage
create or replace function public.check_blocage_desinscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date        timestamptz;
  v_blocage_h   integer;
  v_role        text;
begin
  v_role := public.mon_role();
  if v_role = 'admin' then
    return old;  -- admin peut toujours désinscrire
  end if;

  select e.date, e.blocage_desinscription_h
    into v_date, v_blocage_h
    from public.taches_bureau t
    join public.evenements e on e.id = t.evenement_id
    where t.id = old.tache_id;

  if v_blocage_h is null or v_date is null then
    return old;  -- pas de blocage ou event sans date
  end if;

  if v_date - (v_blocage_h * interval '1 hour') <= now() then
    raise exception 'Désinscription bloquée (moins de %h avant l''événement)', v_blocage_h
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_check_blocage on public.inscriptions_taches;
create trigger trg_check_blocage
  before delete on public.inscriptions_taches
  for each row execute function public.check_blocage_desinscription();

-- ============================================================================
-- 6. Table templates_taches : modèles réutilisables
--    (chaque template = un nom + une liste JSON de tâches)
-- ============================================================================
create table if not exists public.templates_taches (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  taches      jsonb not null default '[]'::jsonb,
    -- Format : [{"titre":"Bar","description":"","capacite":4,"ordre":0}, ...]
  created_by  uuid references public.profils(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (nom)
);

alter table public.templates_taches enable row level security;

-- SELECT/INSERT/UPDATE/DELETE : bureau uniquement
drop policy if exists "templates_taches_select" on public.templates_taches;
create policy "templates_taches_select" on public.templates_taches
  for select to authenticated
  using (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

drop policy if exists "templates_taches_write" on public.templates_taches;
create policy "templates_taches_write" on public.templates_taches
  for all to authenticated
  using (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  )
  with check (
    (public.mon_role() in ('membre', 'admin'))
    and (select bureau from public.profils where id = auth.uid()) = true
  );

drop trigger if exists trg_touch_templates_taches on public.templates_taches;
create trigger trg_touch_templates_taches
  before update on public.templates_taches
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- 7. Injection des 2 templates de base
-- ============================================================================
insert into public.templates_taches (nom, taches)
values
  ('Soirée', '[
    {"titre":"Mise en place","description":"Installation, décoration","capacite":null,"ordre":0},
    {"titre":"Bar","description":"Service au bar pendant la soirée","capacite":null,"ordre":1},
    {"titre":"Vestiaire","description":"Tenue du vestiaire","capacite":2,"ordre":2},
    {"titre":"Fermeture","description":"Rangement et nettoyage fin de soirée","capacite":null,"ordre":3}
  ]'::jsonb),
  ('Vente', '[
    {"titre":"Préparation","description":"Achats et préparation la veille/le matin","capacite":null,"ordre":0},
    {"titre":"Caisse","description":"Tenue de la caisse","capacite":2,"ordre":1},
    {"titre":"Vente","description":"Service et vente aux étudiants","capacite":null,"ordre":2},
    {"titre":"Rangement","description":"Nettoyage et rangement du stand","capacite":null,"ordre":3}
  ]'::jsonb)
on conflict (nom) do nothing;
