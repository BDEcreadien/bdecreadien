-- Migration 007 — Phase 2 Membre BDE
-- + Réponses aux feedbacks (visibles par l'auteur du feedback)

alter table public.feedbacks add column if not exists reponse text;
alter table public.feedbacks add column if not exists repondu_par uuid references public.profils(id);
alter table public.feedbacks add column if not exists repondu_at timestamptz;
