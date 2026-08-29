-- Migration 021 — v2 finances : catégorie personnalisée

-- Retire la contrainte stricte sur la catégorie pour autoriser le libellé libre
alter table public.transactions
  drop constraint if exists transactions_categorie_check;

-- Contrainte plus légère : juste longueur max
alter table public.transactions
  add constraint transactions_categorie_length
  check (char_length(categorie) between 1 and 60);
