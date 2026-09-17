-- Migration 048 — Table billetteries (config des pages de vente)
-- ============================================================================
-- Chaque billetterie = 1 event public avec sa page de vente sur bdecreadien.fr.
-- Le lien avec HelloAsso se fait via hello_asso_form_slug.

create table if not exists public.billetteries (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  hello_asso_form_slug text,
  titre text not null,
  date_affiche text default '',
  lieu_affiche text default '',
  description text default '',
  max_par_acheteur int not null default 4,
  tarifs jsonb not null default '[]'::jsonb,
  cta_texte text default 'Payer ma place',
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billetteries_slug on public.billetteries(slug);
create index if not exists idx_billetteries_actif on public.billetteries(actif);

alter table public.billetteries enable row level security;

-- Lecture publique (page de vente accessible à tous)
drop policy if exists "billetteries_lect_public" on public.billetteries;
create policy "billetteries_lect_public" on public.billetteries for select
  using (actif = true);

-- Écriture bureau uniquement
drop policy if exists "billetteries_ecr_bureau" on public.billetteries;
create policy "billetteries_ecr_bureau" on public.billetteries for all
  using (exists (select 1 from public.profils p where p.id = auth.uid()
                 and p.role in ('membre','admin') and p.bureau = true))
  with check (exists (select 1 from public.profils p where p.id = auth.uid()
                      and p.role in ('membre','admin') and p.bureau = true));

-- Trigger updated_at
create or replace function public.billetteries_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_billetteries_updated_at on public.billetteries;
create trigger trg_billetteries_updated_at
  before update on public.billetteries
  for each row execute function public.billetteries_touch_updated_at();

-- Seed : la "Soirée intégration" existante
insert into public.billetteries (slug, hello_asso_form_slug, titre, date_affiche, lieu_affiche, description, tarifs)
values (
  'soiree-integration',
  'soiree-integration',
  'Soirée d''intégration',
  '🗓️ Date à confirmer',
  '📍 Lieu à confirmer',
  E'Rejoins tes camarades de promo et l''ensemble des étudiants CREAD pour une soirée inoubliable !\n\n🎵 Musique par nos DJ étudiants\n🍹 Bar sur place\n🎁 Cadeaux et goodies BDE\n🤝 Rencontres avec les 1ère à 5ème année\n\nNombre de places limité : réserve la tienne dès maintenant.',
  '[{"id":"etudiant-cread","nom":"Étudiant CREAD","desc":"Sur présentation de la carte étudiante","prix_centimes":1500}]'::jsonb
) on conflict (slug) do nothing;
