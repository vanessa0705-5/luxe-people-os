CREATE POLICY "admissao_docs_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admissao-documentos');
CREATE POLICY "admissao_docs_write_rh" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admissao-documentos' AND public.pode_gerenciar_rh(auth.uid()));
CREATE POLICY "admissao_docs_update_rh" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'admissao-documentos' AND public.pode_gerenciar_rh(auth.uid()));
