-- Migration 070 — Paramètres du BDE (identité, contact, couleurs, légal, modules)
-- Table clé/valeur LISIBLE PAR TOUS (pages publiques, mails) et modifiable par les admins.
-- Ne jamais y stocker de secret : les secrets restent dans bde_config (accès restreint).

create table if not exists public.bde_parametres (
  cle         text primary key,
  valeur      text not null default '',
  updated_at  timestamptz default now(),
  updated_by  uuid references public.profils(id)
);

alter table public.bde_parametres enable row level security;

drop policy if exists "bde_parametres_select_all"   on public.bde_parametres;
drop policy if exists "bde_parametres_insert_admin" on public.bde_parametres;
drop policy if exists "bde_parametres_update_admin" on public.bde_parametres;
drop policy if exists "bde_parametres_delete_admin" on public.bde_parametres;

create policy "bde_parametres_select_all"   on public.bde_parametres for select using (true);
create policy "bde_parametres_insert_admin" on public.bde_parametres for insert with check (mon_role() = 'admin');
create policy "bde_parametres_update_admin" on public.bde_parametres for update using (mon_role() = 'admin');
create policy "bde_parametres_delete_admin" on public.bde_parametres for delete using (mon_role() = 'admin');

-- Valeurs actuelles du BDE CREAD Lyon (point de départ, modifiables depuis l'admin)
insert into public.bde_parametres (cle, valeur) values
  ('nom',                'BDE CREAD Lyon'),
  ('nom_court',          'CREAD'),
  ('logo_ligne1',        'BDE LYON'),
  ('logo_ligne2',        'CREAD'),
  ('ecole',              'CREAD Lyon'),
  ('ville',              'Lyon'),
  ('slogan',             'Le bureau des étudiants de l''école CREAD Lyon. Architecture intérieure & design.'),
  ('logo_url',           '/assets/Logo-nav.png'),
  ('couleur_principale', '#460186'),
  ('couleur_secondaire', '#D2396D'),
  ('couleur_accent',     '#FF741F'),
  ('email_contact',      'bdecreadien@gmail.com'),
  ('telephone',          ''),
  ('adresse',            ''),
  ('instagram_handle',   'bdecreadien'),
  ('instagram_url',      'https://www.instagram.com/bdecreadien'),
  ('site_url',           'https://bdecreadien.fr'),
  ('mail_expediteur',    'noreply@bdecreadien.fr'),
  ('nom_expediteur',     'BDE CREAD Lyon'),
  ('asso_nom_legal',     ''),
  ('asso_siret',         ''),
  ('asso_rna',           ''),
  ('asso_adresse',       ''),
  ('asso_responsable',   ''),
  ('boutique_retrait_lieu',    'Hall de l''école'),
  ('boutique_retrait_horaire', 'Midi de 12h30 à 14h'),
  ('modules_actifs',     'contenu,boutique,billetterie,finances,facturation,planning,newsletter,fidelite,liens,qr,stats')
on conflict (cle) do nothing;
