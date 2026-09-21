-- Ajoute virement_sumup et sumup_cash comme moyens de paiement valides
alter table transactions drop constraint if exists transactions_moyen_paiement_check;
alter table transactions add constraint transactions_moyen_paiement_check
  check (moyen_paiement in ('cb','virement','especes','cheque','autre','virement_sumup','sumup_cash'));
