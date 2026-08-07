-- Extend messaging_channel enum for LiveKit Internet Phone (own transaction).
ALTER TYPE public.messaging_channel ADD VALUE IF NOT EXISTS 'internet_phone';
