-- Stocke les montants partiels affectés à un event pour les transactions multi-events
-- ex: un virement SumUp de 88.93€ dont seulement 65€ concernent cet event
alter table finance_evenements
  add column if not exists tx_montants_partiels jsonb default '{}'::jsonb;
