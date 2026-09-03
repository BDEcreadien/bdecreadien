-- Migration 026 — Liens v2 : deux types (social petit / principal grande carte avec image)

alter table public.liens
  add column if not exists type text not null default 'principal'
    check (type in ('social', 'principal'));

alter table public.liens
  add column if not exists image_url text;

alter table public.liens
  add column if not exists social_icon text;
-- social_icon : identifiant d'une icône SVG prédéfinie (instagram, tiktok, website, youtube, discord, twitter, facebook, linkedin, snapchat, spotify)

comment on column public.liens.type is
  'social = petit rond dans la barre du haut / principal = carte pleine largeur avec image';
comment on column public.liens.image_url is
  'URL ou chemin de la miniature (pour les liens principaux)';
comment on column public.liens.social_icon is
  'Identifiant SVG prédéfini (instagram, tiktok, website, youtube, discord, twitter, facebook, linkedin, snapchat, spotify)';
