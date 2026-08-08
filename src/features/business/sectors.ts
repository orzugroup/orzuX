export const BUSINESS_SECTOR_OTHER = "other" as const;
export const BUSINESS_TYPE_OTHER = "other" as const;

export const BUSINESS_SECTOR_OPTIONS = [
  { value: "beauty", label: "Beauty & personal care" },
  { value: "health", label: "Health & wellness" },
  { value: "restaurant", label: "Restaurant & café" },
  { value: "retail", label: "Retail & e-commerce" },
  { value: "professional", label: "Professional services" },
  { value: "education", label: "Education & training" },
  { value: "real_estate", label: "Real estate" },
  { value: "automotive", label: "Automotive" },
  { value: "hospitality", label: "Hospitality & travel" },
  { value: "home_services", label: "Home services" },
  { value: "general", label: "General / mixed" },
  { value: BUSINESS_SECTOR_OTHER, label: "Other — specify" },
] as const;

export const BUSINESS_TYPE_OPTIONS = [
  { value: "local_service", label: "Local service business" },
  { value: "online_store", label: "Online store" },
  { value: "company", label: "Company / LLC" },
  { value: "individual", label: "Individual entrepreneur" },
  { value: "agency", label: "Agency / studio" },
  { value: "franchise", label: "Franchise / chain" },
  { value: BUSINESS_TYPE_OTHER, label: "Other — specify" },
] as const;

export const BUSINESS_EMPLOYEE_COUNT_OPTIONS = [
  { value: "1_5", label: "1–5" },
  { value: "6_20", label: "6–20" },
  { value: "21_50", label: "21–50" },
  { value: "51_200", label: "51–200" },
  { value: "200_plus", label: "200+" },
] as const;

export type BusinessSectorValue =
  (typeof BUSINESS_SECTOR_OPTIONS)[number]["value"];
export type BusinessTypeValue = (typeof BUSINESS_TYPE_OPTIONS)[number]["value"];
export type BusinessEmployeeCountValue =
  (typeof BUSINESS_EMPLOYEE_COUNT_OPTIONS)[number]["value"];

const SECTOR_LABELS = Object.fromEntries(
  BUSINESS_SECTOR_OPTIONS.map((item) => [item.value, item.label]),
) as Record<string, string>;

const TYPE_LABELS = Object.fromEntries(
  BUSINESS_TYPE_OPTIONS.map((item) => [item.value, item.label]),
) as Record<string, string>;

const EMPLOYEE_COUNT_LABELS = Object.fromEntries(
  BUSINESS_EMPLOYEE_COUNT_OPTIONS.map((item) => [item.value, item.label]),
) as Record<string, string>;

export function resolveBusinessSectorLabel(
  sector: string | null | undefined,
  custom: string | null | undefined,
): string | null {
  const key = sector?.trim();
  if (!key) return null;
  if (key === BUSINESS_SECTOR_OTHER) {
    return custom?.trim() || "Other";
  }
  return SECTOR_LABELS[key] ?? key;
}

export function resolveBusinessTypeLabel(
  type: string | null | undefined,
  custom: string | null | undefined,
): string | null {
  const key = type?.trim();
  if (!key) return null;
  if (key === BUSINESS_TYPE_OTHER) {
    return custom?.trim() || "Other";
  }
  return TYPE_LABELS[key] ?? key;
}

export function resolveEmployeeCountLabel(
  value: string | null | undefined,
): string | null {
  const key = value?.trim();
  if (!key) return null;
  return EMPLOYEE_COUNT_LABELS[key] ?? key;
}
