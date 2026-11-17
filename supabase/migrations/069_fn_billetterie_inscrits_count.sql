-- Fonction publique (SECURITY DEFINER) pour compter les inscrits confirmés
-- sans exposer les données individuelles via RLS
CREATE OR REPLACE FUNCTION public.billetterie_inscrits_count(p_slug text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM billetterie_inscriptions
  WHERE billetterie_slug = p_slug
  AND statut IN ('confirmee', 'confirme', 'payee', 'rejoint');
$$;
