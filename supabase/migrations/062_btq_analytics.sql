-- Migration 062 : table btq_analytics + RLS
-- Tracking des événements boutique (page_view, product_view, add_to_cart, product_time, help_click)
-- Colle et exécute dans le SQL Editor Supabase si les stats ne remontent pas

CREATE TABLE IF NOT EXISTS public.btq_analytics (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event       text        NOT NULL,
  product_id  uuid        REFERENCES public.boutique_produits(id) ON DELETE SET NULL,
  product_nom text,
  data        jsonb       DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index pour les requêtes par date (très utilisé dans btqLoadAnalytics)
CREATE INDEX IF NOT EXISTS btq_analytics_created_at_idx ON public.btq_analytics (created_at DESC);

-- Activer RLS
ALTER TABLE public.btq_analytics ENABLE ROW LEVEL SECURITY;

-- INSERT : tous les utilisateurs authentifiés (étudiants, membres, admins)
DROP POLICY IF EXISTS "btq_analytics_insert_auth" ON public.btq_analytics;
CREATE POLICY "btq_analytics_insert_auth" ON public.btq_analytics
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- SELECT : bureau uniquement (admins et membres bureau)
DROP POLICY IF EXISTS "btq_analytics_select_bureau" ON public.btq_analytics;
CREATE POLICY "btq_analytics_select_bureau" ON public.btq_analytics
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profils p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR (p.role = 'membre' AND p.bureau = true))
    )
  );

-- DELETE : admins uniquement (pour le reset analytics)
DROP POLICY IF EXISTS "btq_analytics_delete_admin" ON public.btq_analytics;
CREATE POLICY "btq_analytics_delete_admin" ON public.btq_analytics
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profils p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
