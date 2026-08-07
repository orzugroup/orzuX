-- Per-business Internet Phone (LiveKit WebRTC) connection + call sessions.

CREATE TABLE IF NOT EXISTS public.internet_phone_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  public_id TEXT NOT NULL,
  connection_status public.website_form_status NOT NULL DEFAULT 'pending',
  display_name TEXT,
  greeting_message TEXT NOT NULL DEFAULT 'Tap Call to speak with us in your browser.',
  primary_color TEXT NOT NULL DEFAULT '#0F766E',
  connected_at TIMESTAMPTZ,
  last_call_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT internet_phone_connections_public_id_format
    CHECK (public_id ~ '^[A-Za-z0-9_-]{8,32}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS internet_phone_connections_business_id_uidx
  ON public.internet_phone_connections (business_id);

CREATE UNIQUE INDEX IF NOT EXISTS internet_phone_connections_public_id_uidx
  ON public.internet_phone_connections (public_id);

CREATE TRIGGER set_internet_phone_connections_updated_at
BEFORE UPDATE ON public.internet_phone_connections
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.internet_phone_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY internet_phone_connections_business_access
ON public.internet_phone_connections
FOR ALL
USING (public.user_can_access_business(business_id))
WITH CHECK (public.user_can_access_business(business_id));

CREATE TABLE IF NOT EXISTS public.internet_phone_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses (id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES public.internet_phone_connections (id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'active', 'ended', 'failed')),
  contact_id UUID REFERENCES public.contacts (id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations (id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS internet_phone_calls_business_started_idx
  ON public.internet_phone_calls (business_id, started_at DESC);

CREATE INDEX IF NOT EXISTS internet_phone_calls_connection_idx
  ON public.internet_phone_calls (connection_id);

CREATE UNIQUE INDEX IF NOT EXISTS internet_phone_calls_room_name_uidx
  ON public.internet_phone_calls (room_name);

CREATE TRIGGER set_internet_phone_calls_updated_at
BEFORE UPDATE ON public.internet_phone_calls
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.internet_phone_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY internet_phone_calls_business_access
ON public.internet_phone_calls
FOR ALL
USING (public.user_can_access_business(business_id))
WITH CHECK (public.user_can_access_business(business_id));

-- Public call page / token mint use service role; no anon SELECT policy on secrets.

INSERT INTO public.channel_analytics (business_id, channel, total_messages, total_contacts, ai_replies, updated_at)
SELECT b.id, 'internet_phone'::public.messaging_channel, 0, 0, 0, timezone('utc', now())
FROM public.businesses AS b
ON CONFLICT DO NOTHING;
