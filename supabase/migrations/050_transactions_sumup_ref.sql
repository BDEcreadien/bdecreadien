-- Référence de la vente SumUp pour éviter les doublons à l'import
alter table transactions
  add column if not exists sumup_ref text unique;
