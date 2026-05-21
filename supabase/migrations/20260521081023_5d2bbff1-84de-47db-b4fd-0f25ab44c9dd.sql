
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE public.health_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  due_date date,
  frequency text,
  notes text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_owner_all" ON public.health_reminders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER health_reminders_touch
  BEFORE UPDATE ON public.health_reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
