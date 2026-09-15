-- Migration 045 — Moyen de paiement + liaison event sur transactions
-- ============================================================================
-- Permet de calculer les coûts/gains RÉELS d'un événement en sélectionnant les
-- transactions concernées, et de distinguer virement/CB/espèces dans les rapports.

alter table public.transactions
  add column if not exists moyen_paiement text not null default 'autre'
    check (moyen_paiement in ('cb','virement','especes','cheque','autre')),
  add column if not exists finance_evenement_id uuid
    references public.finance_evenements(id) on delete set null;

create index if not exists idx_transactions_finance_evenement
  on public.transactions (finance_evenement_id);

comment on column public.transactions.moyen_paiement is 'Moyen de paiement (cb/virement/especes/cheque/autre)';
comment on column public.transactions.finance_evenement_id is 'Événement financier auquel cette transaction est rattachée (facultatif)';
