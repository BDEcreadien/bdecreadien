-- Migration 046 — Facturation BDE
-- ============================================================================
-- Table pour stocker les factures + bucket storage pour les PDF générés.
-- Le bloc "émetteur" (nom titulaire, RIB, adresse) est stocké dans bde_config
-- et snapshotté dans chaque facture pour préserver l'historique si le RIB change.

create table if not exists public.factures (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  annee_scolaire text not null,
  date_facturation date not null default current_date,
  date_echeance text,
  client_nom text not null default '',
  client_ligne1 text default '',
  client_ligne2 text default '',
  client_ligne3 text default '',
  lignes jsonb not null default '[]'::jsonb,
  total_ttc numeric(10,2) not null default 0,
  mode_paiement text default 'Chèque ou Virement',
  emetteur jsonb not null default '{}'::jsonb,
  pdf_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_factures_annee on public.factures(annee_scolaire);
create index if not exists idx_factures_date on public.factures(date_facturation desc);

alter table public.factures enable row level security;

drop policy if exists "bureau_lect_factures"  on public.factures;
drop policy if exists "bureau_ins_factures"   on public.factures;
drop policy if exists "bureau_upd_factures"   on public.factures;
drop policy if exists "bureau_del_factures"   on public.factures;

create policy "bureau_lect_factures" on public.factures for select
  using (exists (select 1 from public.profils p where p.id = auth.uid()
                 and p.role in ('membre','admin') and p.bureau = true));

create policy "bureau_ins_factures" on public.factures for insert
  with check (exists (select 1 from public.profils p where p.id = auth.uid()
                      and p.role in ('membre','admin') and p.bureau = true));

create policy "bureau_upd_factures" on public.factures for update
  using (exists (select 1 from public.profils p where p.id = auth.uid()
                 and p.role in ('membre','admin') and p.bureau = true));

create policy "bureau_del_factures" on public.factures for delete
  using (exists (select 1 from public.profils p where p.id = auth.uid()
                 and p.role in ('membre','admin') and p.bureau = true));

-- Trigger updated_at
create or replace function public.factures_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_factures_updated_at on public.factures;
create trigger trg_factures_updated_at
  before update on public.factures
  for each row execute function public.factures_touch_updated_at();

-- Bucket storage privé pour les PDF
insert into storage.buckets (id, name, public)
  values ('factures', 'factures', false)
  on conflict (id) do nothing;

drop policy if exists "bureau_stockage_lect_factures" on storage.objects;
drop policy if exists "bureau_stockage_ecr_factures"  on storage.objects;
drop policy if exists "bureau_stockage_supp_factures" on storage.objects;

create policy "bureau_stockage_lect_factures" on storage.objects for select
  using (bucket_id = 'factures' and exists (select 1 from public.profils p
    where p.id = auth.uid() and p.role in ('membre','admin') and p.bureau = true));

create policy "bureau_stockage_ecr_factures" on storage.objects for insert
  with check (bucket_id = 'factures' and exists (select 1 from public.profils p
    where p.id = auth.uid() and p.role in ('membre','admin') and p.bureau = true));

create policy "bureau_stockage_supp_factures" on storage.objects for delete
  using (bucket_id = 'factures' and exists (select 1 from public.profils p
    where p.id = auth.uid() and p.role in ('membre','admin') and p.bureau = true));
