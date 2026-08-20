-- Ajoute un tableau de photos aux annonces (pour les logements, matériel, etc.)
alter table public.annonces
  add column if not exists photos jsonb not null default '[]'::jsonb;
