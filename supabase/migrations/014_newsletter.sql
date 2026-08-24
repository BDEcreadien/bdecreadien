-- Migration 014 — Newsletter + rôle Admin/Prof

-- 1. Ajoute 'Admin/Prof' à la contrainte annee
alter table public.profils drop constraint if exists profils_annee_check;
alter table public.profils
  add constraint profils_annee_check
  check (annee in ('1ère','2ème','3ème','4ème','5ème','Admin/Prof'));

-- 2. Table des abonnés newsletter
create table if not exists public.newsletter_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  nom               text,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  status            text not null default 'active' check (status in ('active','unsubscribed')),
  source            text default 'site',
  subscribed_at     timestamptz not null default now(),
  unsubscribed_at   timestamptz
);

create index if not exists idx_newsletter_status on public.newsletter_subscribers (status);
create index if not exists idx_newsletter_token on public.newsletter_subscribers (unsubscribe_token);

alter table public.newsletter_subscribers enable row level security;

-- Insert anonyme autorisé (formulaire public) — pas de UPDATE/SELECT/DELETE public
drop policy if exists "newsletter_insert_public" on public.newsletter_subscribers;
create policy "newsletter_insert_public" on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (
    status = 'active'
    and email is not null
    and length(email) <= 254
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- Admin lit + gère
drop policy if exists "newsletter_admin_all" on public.newsletter_subscribers;
create policy "newsletter_admin_all" on public.newsletter_subscribers
  for all to authenticated
  using (public.mon_role() = 'admin')
  with check (public.mon_role() = 'admin');

-- Fonction de désinscription (accès via token, sans auth)
create or replace function public.unsubscribe_newsletter(p_token uuid)
returns table (email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.newsletter_subscribers
     set status = 'unsubscribed',
         unsubscribed_at = now()
   where unsubscribe_token = p_token
     and status = 'active'
  returning newsletter_subscribers.email;
end;
$$;

revoke execute on function public.unsubscribe_newsletter(uuid) from public;
grant execute on function public.unsubscribe_newsletter(uuid) to anon, authenticated;

-- 3. Historique des envois
create table if not exists public.newsletter_envois (
  id                uuid primary key default gen_random_uuid(),
  sujet             text not null,
  contenu_html      text not null,
  envoye_le         timestamptz not null default now(),
  envoye_par        uuid references auth.users(id) on delete set null,
  nb_destinataires  int not null default 0,
  nb_erreurs        int not null default 0
);

alter table public.newsletter_envois enable row level security;

drop policy if exists "newsletter_envois_admin" on public.newsletter_envois;
create policy "newsletter_envois_admin" on public.newsletter_envois
  for all to authenticated
  using (public.mon_role() = 'admin')
  with check (public.mon_role() = 'admin');
