DROP POLICY IF EXISTS "Listing photos are public" ON storage.objects;
CREATE POLICY "Listing photos readable by owner or when published"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'listing-photos' AND (
    (storage.foldername(name))[1] = (select auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.host_listings l
      WHERE l.status = 'publiée' AND storage.objects.name = ANY(l.photos)
    )
  )
);