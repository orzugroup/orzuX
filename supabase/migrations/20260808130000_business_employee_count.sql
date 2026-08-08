-- Optional enrichment fields for business profile onboarding.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS employee_count text;

COMMENT ON COLUMN public.businesses.employee_count IS
  'Optional team size range from onboarding (e.g. 1_5, 6_20, 21_50, 51_200, 200_plus).';
