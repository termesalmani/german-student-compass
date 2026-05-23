
ALTER TABLE public.bureaucracy_items
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_at timestamptz;

CREATE TABLE IF NOT EXISTS public.bureaucracy_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.bureaucracy_items(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bureaucracy_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bureaucracy_files_owner_all"
  ON public.bureaucracy_files FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER bureaucracy_files_touch_updated
  BEFORE UPDATE ON public.bureaucracy_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('bureaucracy-docs', 'bureaucracy-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bureaucracy_docs_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bureaucracy-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "bureaucracy_docs_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bureaucracy-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "bureaucracy_docs_update_own"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'bureaucracy-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "bureaucracy_docs_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bureaucracy-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
