import type { Business } from "@/types/database.types";
import type { BusinessProfileData } from "@/types/business.types";
import {
  BUSINESS_SECTOR_OTHER,
  BUSINESS_TYPE_OTHER,
  resolveBusinessSectorLabel,
  resolveBusinessTypeLabel,
} from "@/features/business/sectors";

export function mapBusinessToProfile(business: Business): BusinessProfileData {
  return {
    id: business.id,
    businessName: business.business_name,
    businessDescription: business.business_description,
    businessSector: business.business_sector,
    businessSectorCustom: business.business_sector_custom,
    businessType: business.business_type,
    businessTypeCustom: business.business_type_custom,
    phone: business.phone,
    email: business.email,
    address: business.address,
    website: business.website,
    logoUrl: business.logo_url,
  };
}

export type BusinessProfileCompletionFields = {
  business_name: string | null;
  business_description: string | null;
  email: string | null;
  business_sector: string | null;
  business_sector_custom: string | null;
  business_type: string | null;
  business_type_custom: string | null;
};

export function isBusinessProfileComplete(
  business: BusinessProfileCompletionFields | null,
): boolean {
  if (!business) return false;

  const name = business.business_name?.trim() ?? "";
  const description = business.business_description?.trim() ?? "";
  const email = business.email?.trim() ?? "";
  const sector = business.business_sector?.trim() ?? "";
  const type = business.business_type?.trim() ?? "";

  if (name.length < 2 || description.length < 10 || !email.includes("@")) {
    return false;
  }

  if (!sector || !type) {
    return false;
  }

  if (
    sector === BUSINESS_SECTOR_OTHER &&
    (business.business_sector_custom?.trim().length ?? 0) < 2
  ) {
    return false;
  }

  if (
    type === BUSINESS_TYPE_OTHER &&
    (business.business_type_custom?.trim().length ?? 0) < 2
  ) {
    return false;
  }

  return true;
}

type BusinessProfileAiSource = {
  business_name: string | null;
  business_description: string | null;
  business_sector: string | null;
  business_sector_custom: string | null;
  business_type: string | null;
  business_type_custom: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
};

export function formatBusinessProfileForAi(
  business: Business | BusinessProfileAiSource,
): string {
  const sectorLabel = resolveBusinessSectorLabel(
    business.business_sector,
    business.business_sector_custom,
  );
  const typeLabel = resolveBusinessTypeLabel(
    business.business_type,
    business.business_type_custom,
  );

  return [
    business.business_name
      ? `Business name: ${business.business_name}`
      : null,
    sectorLabel ? `Industry / sector: ${sectorLabel}` : null,
    typeLabel ? `Business type: ${typeLabel}` : null,
    business.business_description
      ? `Description: ${business.business_description}`
      : null,
    business.email ? `Contact email: ${business.email}` : null,
    business.phone ? `Phone: ${business.phone}` : null,
    business.address ? `Address: ${business.address}` : null,
    business.website ? `Website: ${business.website}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function getBusinessLogoExtension(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

export function buildBusinessLogoPath(
  userId: string,
  businessId: string,
  extension: string,
): string {
  return `${userId}/${businessId}/logo.${extension}`;
}

export function emptyStringToNull(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}
