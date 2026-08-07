CREATE POLICY "Autenticados veem documentos sst" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documentos-sst');

CREATE POLICY "SST RH e Admin enviam documentos sst" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-sst' AND public.pode_gerenciar_sst(auth.uid()));

CREATE POLICY "SST RH e Admin atualizam documentos sst" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-sst' AND public.pode_gerenciar_sst(auth.uid()))
  WITH CHECK (bucket_id = 'documentos-sst' AND public.pode_gerenciar_sst(auth.uid()));

CREATE POLICY "Somente Admin Principal remove documentos sst" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-sst' AND public.is_admin_principal(auth.uid()));