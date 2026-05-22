
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS tasks_user_sort_idx ON public.tasks(user_id, sort_order);

CREATE TABLE IF NOT EXISTS public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  note text,
  due_date date,
  reminder_at timestamptz,
  repeat_frequency text NOT NULL DEFAULT 'none',
  completed boolean NOT NULL DEFAULT false,
  source_type text NOT NULL DEFAULT 'custom',
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminders_owner_all ON public.reminders
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER reminders_touch_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS reminders_user_reminder_at_idx ON public.reminders(user_id, reminder_at);
