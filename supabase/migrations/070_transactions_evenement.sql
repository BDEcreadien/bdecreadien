-- Ajoute un champ evenement optionnel sur les transactions
-- Permet de regrouper les transactions par événement BDE (soirée, sortie, etc.)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS evenement TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_evenement
  ON public.transactions(evenement)
  WHERE evenement IS NOT NULL;
