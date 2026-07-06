-- ============================================
-- Migration 003 — Profil enrichi + événements + feedback
-- ============================================

-- Avatar sur profils
alter table public.profils
  add column if not exists avatar_url text;

-- ============================================
-- Table inscriptions_evenements
-- ============================================
create table if not exists public.inscriptions_evenements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profils(id) on delete cascade not null,
  evenement_slug  text not null,
  evenement_titre text not null,
  evenement_date  date,
  created_at      timestamptz default now(),
  unique(user_id, evenement_slug)
);

create index if not exists insc_user_idx on public.inscriptions_evenements(user_id);
create index if not exists insc_slug_idx on public.inscriptions_evenements(evenement_slug);

alter table public.inscriptions_evenements enable row level security;

create policy "insc_select"
  on public.inscriptions_evenements for select
  using (user_id = auth.uid() or mon_role() in ('admin','responsable'));

create policy "insc_insert_own"
  on public.inscriptions_evenements for insert
  with check (user_id = auth.uid());

create policy "insc_delete_own"
  on public.inscriptions_evenements for delete
  using (user_id = auth.uid());

-- ============================================
-- Table feedbacks
-- ============================================
create table if not exists public.feedbacks (
  id          uuid primary key default gen_random_uuid(),
  auteur_id   uuid references public.profils(id) on delete set null,
  sujet       text not null,
  message     text not null,
  statut      text not null default 'nouveau' check (statut in ('nouveau','vu','traite')),
  created_at  timestamptz default now()
);

create index if not exists fb_statut_idx on public.feedbacks(statut);

alter table public.feedbacks enable row level security;

create policy "fb_select"
  on public.feedbacks for select
  using (auteur_id = auth.uid() or mon_role() in ('admin','responsable'));

create policy "fb_insert_auth"
  on public.feedbacks for insert
  with check (auteur_id = auth.uid());

create policy "fb_update_admin"
  on public.feedbacks for update
  using (mon_role() in ('admin','responsable'));

-- ============================================
-- Storage policies pour bucket "annonces"
-- ============================================
create policy "annonces_upload_auth"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'annonces');

create policy "annonces_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'annonces'
    and (owner = auth.uid() or mon_role() in ('admin','responsable'))
  );

-- ============================================
-- Storage policies pour bucket "avatars"
-- ============================================
create policy "avatars_upload_auth"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());

create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and owner = auth.uid());
