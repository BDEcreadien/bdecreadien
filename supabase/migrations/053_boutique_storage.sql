-- Migration 053 — Bucket Supabase Storage pour les visuels boutique
-- (produits + designs)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('boutique', 'boutique', true, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Lecture publique
DROP POLICY IF EXISTS "boutique_public_read" ON storage.objects;
CREATE POLICY "boutique_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'boutique');

-- Upload bureau uniquement
DROP POLICY IF EXISTS "boutique_bureau_insert" ON storage.objects;
CREATE POLICY "boutique_bureau_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'boutique'
    AND EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true)
  );

-- Mise à jour bureau
DROP POLICY IF EXISTS "boutique_bureau_update" ON storage.objects;
CREATE POLICY "boutique_bureau_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'boutique'
    AND EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true)
  );

-- Suppression bureau
DROP POLICY IF EXISTS "boutique_bureau_delete" ON storage.objects;
CREATE POLICY "boutique_bureau_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'boutique'
    AND EXISTS (SELECT 1 FROM public.profils WHERE id = auth.uid() AND bureau = true)
  );
