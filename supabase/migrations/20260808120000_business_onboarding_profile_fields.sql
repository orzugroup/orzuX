-- Business profile fields for onboarding (sector, type) and AI fallback context.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_sector text,
  ADD COLUMN IF NOT EXISTS business_sector_custom text,
  ADD COLUMN IF NOT EXISTS business_type text,
  ADD COLUMN IF NOT EXISTS business_type_custom text;

COMMENT ON COLUMN public.businesses.business_sector IS
  'Industry sphere slug from onboarding (e.g. beauty, retail). Value other uses business_sector_custom.';

COMMENT ON COLUMN public.businesses.business_sector_custom IS
  'Free-text sector when business_sector is other.';

COMMENT ON COLUMN public.businesses.business_type IS
  'Business model / legal type slug from onboarding. Value other uses business_type_custom.';

COMMENT ON COLUMN public.businesses.business_type_custom IS
  'Free-text business type when business_type is other.';

UPDATE public.businesses
SET
  business_sector = COALESCE(NULLIF(btrim(business_sector), ''), 'general'),
  business_type = COALESCE(NULLIF(btrim(business_type), ''), 'local_service')
WHERE business_sector IS NULL
   OR btrim(business_sector) = ''
   OR business_type IS NULL
   OR btrim(business_type) = '';
