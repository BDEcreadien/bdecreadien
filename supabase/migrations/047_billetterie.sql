-- Migration 047 — Billetterie HelloAsso
-- ============================================================================
-- Modèle : chaque event du site peut être lié à un formulaire HelloAsso.
-- Les ventes arrivent via webhook et se matérialisent en billets nominatifs
-- avec QR code unique pour check-in à l'entrée.

-- --------------------------------------------------------------------------
-- 1) Lien event → formulaire HelloAsso
-- --------------------------------------------------------------------------
alter table if exists public.evenements
  add column if not exists hello_asso_form_slug text,
  add column if not exists hello_asso_form_type text default 'Event',
  add column if not exists billetterie_active boolean not null default false,
  add column if not exists billetterie_max_par_acheteur int default 4;

comment on column public.evenements.hello_asso_form_slug is
  'Slug du formulaire HelloAsso (ex: "soiree-halloween-2026"). NULL = pas de billetterie en ligne.';

-- --------------------------------------------------------------------------
-- 2) Tarifs (miroir local des tarifs HelloAsso pour affichage rapide sur le site)
-- --------------------------------------------------------------------------
create table if not exists public.billetterie_tarifs (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements(id) on delete cascade,
  hello_asso_tier_id bigint,
  libelle text not null,
  prix_centimes int not null,
  stock_max int,
  stock_vendu int not null default 0,
  date_debut timestamptz,
  date_fin timestamptz,
  actif boolean not null default true,
  ordre int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_bt_evenement on public.billetterie_tarifs(evenement_id);
create index if not exists idx_bt_ha_tier on public.billetterie_tarifs(hello_asso_tier_id);

-- --------------------------------------------------------------------------
-- 3) Ventes (une commande = un paiement HelloAsso)
-- --------------------------------------------------------------------------
create table if not exists public.billetterie_ventes (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid references public.evenements(id) on delete set null,
  hello_asso_order_id bigint unique,
  hello_asso_payment_id bigint,
  acheteur_user_id uuid references auth.users(id) on delete set null,
  acheteur_nom text,
  acheteur_prenom text,
  acheteur_email text,
  acheteur_tel text,
  montant_total_centimes int not null default 0,
  statut text not null default 'en_attente'
    check (statut in ('en_attente','payee','remboursee','annulee','echec')),
  transaction_id uuid,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bv_evenement on public.billetterie_ventes(evenement_id);
create index if not exists idx_bv_user on public.billetterie_ventes(acheteur_user_id);
create index if not exists idx_bv_email on public.billetterie_ventes(acheteur_email);
create index if not exists idx_bv_statut on public.billetterie_ventes(statut);

-- --------------------------------------------------------------------------
-- 4) Billets nominatifs (1 vente peut contenir plusieurs billets)
-- --------------------------------------------------------------------------
create table if not exists public.billetterie_billets (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.billetterie_ventes(id) on delete cascade,
  evenement_id uuid references public.evenements(id) on delete set null,
  tarif_id uuid references public.billetterie_tarifs(id) on delete set null,
  tarif_libelle text not null,
  prix_centimes int not null,
  porteur_nom text,
  porteur_prenom text,
  porteur_email text,
  qr_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  utilise_le timestamptz,
  utilise_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_bb_vente on public.billetterie_billets(vente_id);
create index if not exists idx_bb_evenement on public.billetterie_billets(evenement_id);
create index if not exists idx_bb_qr on public.billetterie_billets(qr_code);
create index if not exists idx_bb_utilise on public.billetterie_billets(utilise_le);

-- --------------------------------------------------------------------------
-- 5) Trigger auto-updated_at sur ventes
-- --------------------------------------------------------------------------
create or replace function public.billetterie_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_bv_updated_at on public.billetterie_ventes;
create trigger trg_bv_updated_at
  before update on public.billetterie_ventes
  for each row execute function public.billetterie_touch_updated_at();

-- --------------------------------------------------------------------------
-- 6) RLS
-- --------------------------------------------------------------------------
alter table public.billetterie_tarifs  enable row level security;
alter table public.billetterie_ventes  enable row level security;
alter table public.billetterie_billets enable row level security;

-- Tarifs : lecture publique (pour afficher les prix), écriture bureau
drop policy if exists "tarifs_lect_public" on public.billetterie_tarifs;
create policy "tarifs_lect_public" on public.billetterie_tarifs for select using (true);

drop policy if exists "tarifs_ecr_bureau" on public.billetterie_tarifs;
create policy "tarifs_ecr_bureau" on public.billetterie_tarifs for all
  using (exists (select 1 from public.profils p where p.id = auth.uid()
                 and p.role in ('membre','admin') and p.bureau = true))
  with check (exists (select 1 from public.profils p where p.id = auth.uid()
                      and p.role in ('membre','admin') and p.bureau = true));

-- Ventes : bureau voit tout, un acheteur voit ses propres ventes
drop policy if exists "ventes_lect_bureau" on public.billetterie_ventes;
create policy "ventes_lect_bureau" on public.billetterie_ventes for select
  using (exists (select 1 from public.profils p where p.id = auth.uid()
                 and p.role in ('membre','admin') and p.bureau = true));

drop policy if exists "ventes_lect_acheteur" on public.billetterie_ventes;
create policy "ventes_lect_acheteur" on public.billetterie_ventes for select
  using (acheteur_user_id = auth.uid());

-- Insert/update des ventes uniquement via la service_role (webhook) — donc pas de policy write

-- Billets : bureau voit tout, acheteur voit ses billets
drop policy if exists "billets_lect_bureau" on public.billetterie_billets;
create policy "billets_lect_bureau" on public.billetterie_billets for select
  using (exists (select 1 from public.profils p where p.id = auth.uid()
                 and p.role in ('membre','admin') and p.bureau = true));

drop policy if exists "billets_lect_acheteur" on public.billetterie_billets;
create policy "billets_lect_acheteur" on public.billetterie_billets for select
  using (exists (select 1 from public.billetterie_ventes v
                 where v.id = vente_id and v.acheteur_user_id = auth.uid()));

-- Marquer un billet utilisé (check-in) : bureau uniquement, via update qr_code
drop policy if exists "billets_upd_bureau" on public.billetterie_billets;
create policy "billets_upd_bureau" on public.billetterie_billets for update
  using (exists (select 1 from public.profils p where p.id = auth.uid()
                 and p.role in ('membre','admin') and p.bureau = true))
  with check (exists (select 1 from public.profils p where p.id = auth.uid()
                      and p.role in ('membre','admin') and p.bureau = true));
