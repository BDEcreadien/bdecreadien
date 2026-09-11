-- Migration 036 — Planning perso des membres du BDE
-- =====================================================================
-- Chaque membre BDE peut créer ses propres tâches à faire (avec ou sans
-- horaire précis). Le bureau peut assigner une tâche à n'importe quel
-- membre et voir le planning de chacun. Récurrentes + commentaires inclus.

-- ============================================================
-- Table principale : tâches ponctuelles
-- ============================================================
create table if not exists public.planning_taches (
  id              uuid primary key default gen_random_uuid(),
  titre           text not null,
  description     text,
  jour            date not null,
  horaire_debut   time,
  horaire_fin     time,
  membre_id       uuid not null references public.profils(id) on delete cascade,
  assigne_par     uuid references public.profils(id) on delete set null,
  statut          text not null default 'a_faire' check (statut in ('a_faire','en_cours','fait')),
  priorite        text not null default 'normale' check (priorite in ('normale','urgente')),
  notes           text,
  from_event_id   uuid,  -- lien vers un event si tâche générée par inscription event (grisée jusqu'à validation)
  event_confirme  boolean not null default true,  -- false = event non encore validé par bureau (affiché en gris)
  created_by      uuid references public.profils(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists planning_taches_membre_jour_idx on public.planning_taches(membre_id, jour);
create index if not exists planning_taches_jour_idx on public.planning_taches(jour);

-- Trigger updated_at
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists planning_taches_updated_at on public.planning_taches;
create trigger planning_taches_updated_at
  before update on public.planning_taches
  for each row execute function public.set_updated_at();

-- ============================================================
-- Récurrentes : règles qui génèrent des tâches virtuelles par semaine
-- ============================================================
create table if not exists public.planning_taches_recurrentes (
  id              uuid primary key default gen_random_uuid(),
  titre           text not null,
  description     text,
  jour_semaine    int  not null check (jour_semaine between 1 and 6),  -- 1=lundi ... 6=samedi
  horaire_debut   time,
  horaire_fin     time,
  membre_id       uuid not null references public.profils(id) on delete cascade,
  assigne_par     uuid references public.profils(id) on delete set null,
  priorite        text not null default 'normale' check (priorite in ('normale','urgente')),
  date_debut      date not null,
  date_fin        date,                     -- null = indéfini
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists planning_recur_membre_idx on public.planning_taches_recurrentes(membre_id);

-- ============================================================
-- Commentaires sous chaque tâche
-- ============================================================
create table if not exists public.planning_taches_commentaires (
  id              uuid primary key default gen_random_uuid(),
  tache_id        uuid not null references public.planning_taches(id) on delete cascade,
  auteur_id       uuid not null references public.profils(id) on delete cascade,
  texte           text not null,
  created_at      timestamptz not null default now()
);

create index if not exists planning_comm_tache_idx on public.planning_taches_commentaires(tache_id);

-- ============================================================
-- Token ICS par utilisateur (pour l'abonnement au calendrier)
-- ============================================================
alter table public.profils
  add column if not exists ics_token text unique;

-- Génère un token pour chaque profil membre BDE qui n'en a pas
update public.profils
   set ics_token = encode(gen_random_bytes(24), 'hex')
 where ics_token is null
   and role in ('membre','admin');

-- ============================================================
-- Helper : est-ce que je suis bureau/admin ?
-- ============================================================
create or replace function public.est_bureau() returns boolean
language sql stable as $$
  select coalesce(
    (select bureau from public.profils where id = auth.uid())
    or public.mon_role() = 'admin',
    false
  );
$$;

-- ============================================================
-- RLS : planning_taches
-- ============================================================
alter table public.planning_taches enable row level security;

drop policy if exists "pt_select" on public.planning_taches;
create policy "pt_select" on public.planning_taches for select
  using (membre_id = auth.uid() or public.est_bureau());

drop policy if exists "pt_insert" on public.planning_taches;
create policy "pt_insert" on public.planning_taches for insert
  with check (
    (membre_id = auth.uid() and (assigne_par is null or assigne_par = auth.uid()))
    or public.est_bureau()
  );

drop policy if exists "pt_update" on public.planning_taches;
create policy "pt_update" on public.planning_taches for update
  using (membre_id = auth.uid() or public.est_bureau());

drop policy if exists "pt_delete" on public.planning_taches;
create policy "pt_delete" on public.planning_taches for delete
  using (membre_id = auth.uid() or public.est_bureau());

-- ============================================================
-- RLS : récurrentes (idem)
-- ============================================================
alter table public.planning_taches_recurrentes enable row level security;

drop policy if exists "ptr_select" on public.planning_taches_recurrentes;
create policy "ptr_select" on public.planning_taches_recurrentes for select
  using (membre_id = auth.uid() or public.est_bureau());

drop policy if exists "ptr_all" on public.planning_taches_recurrentes;
create policy "ptr_all" on public.planning_taches_recurrentes for all
  using (membre_id = auth.uid() or public.est_bureau())
  with check (membre_id = auth.uid() or public.est_bureau());

-- ============================================================
-- RLS : commentaires
-- ============================================================
alter table public.planning_taches_commentaires enable row level security;

drop policy if exists "ptc_select" on public.planning_taches_commentaires;
create policy "ptc_select" on public.planning_taches_commentaires for select
  using (
    exists (
      select 1 from public.planning_taches t
       where t.id = tache_id
         and (t.membre_id = auth.uid() or public.est_bureau())
    )
  );

drop policy if exists "ptc_insert" on public.planning_taches_commentaires;
create policy "ptc_insert" on public.planning_taches_commentaires for insert
  with check (
    auteur_id = auth.uid()
    and exists (
      select 1 from public.planning_taches t
       where t.id = tache_id
         and (t.membre_id = auth.uid() or public.est_bureau())
    )
  );

drop policy if exists "ptc_delete" on public.planning_taches_commentaires;
create policy "ptc_delete" on public.planning_taches_commentaires for delete
  using (auteur_id = auth.uid() or public.est_bureau());

-- ============================================================
-- RPC : régénérer son token ICS (au cas où on veut invalider l'ancien)
-- ============================================================
create or replace function public.regen_ics_token() returns text
language plpgsql security definer as $$
declare new_token text;
begin
  new_token := encode(gen_random_bytes(24), 'hex');
  update public.profils set ics_token = new_token where id = auth.uid();
  return new_token;
end;
$$;

revoke all on function public.regen_ics_token() from public;
grant execute on function public.regen_ics_token() to authenticated;
