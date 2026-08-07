-- Internet Phone: AI agent lifecycle + staff handoff fields.

ALTER TABLE public.internet_phone_calls
  DROP CONSTRAINT IF EXISTS internet_phone_calls_status_check;

ALTER TABLE public.internet_phone_calls
  ADD CONSTRAINT internet_phone_calls_status_check
  CHECK (status IN ('started', 'ringing', 'ai_active', 'human_active', 'active', 'ended', 'failed'));

ALTER TABLE public.internet_phone_calls
  ADD COLUMN IF NOT EXISTS call_mode TEXT NOT NULL DEFAULT 'ai'
    CHECK (call_mode IN ('ai', 'human', 'handoff')),
  ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ai_status IN ('pending', 'joining', 'active', 'muted', 'left', 'failed')),
  ADD COLUMN IF NOT EXISTS ai_identity TEXT,
  ADD COLUMN IF NOT EXISTS ai_joined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_left_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS human_handled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handoff_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_user_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_identity TEXT,
  ADD COLUMN IF NOT EXISTS ended_reason TEXT
    CHECK (
      ended_reason IS NULL
      OR ended_reason IN (
        'customer_hangup',
        'staff_end',
        'ai_end',
        'failed',
        'timeout'
      )
    ),
  ADD COLUMN IF NOT EXISTS staff_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS staff_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS internet_phone_calls_business_active_idx
  ON public.internet_phone_calls (business_id, started_at DESC)
  WHERE ended_at IS NULL;

ALTER TABLE public.internet_phone_calls REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'internet_phone_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internet_phone_calls;
  END IF;
END $$;
