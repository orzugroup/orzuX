import { z } from "zod";

import {
  BUSINESS_EMPLOYEE_COUNT_OPTIONS,
  BUSINESS_SECTOR_OPTIONS,
  BUSINESS_SECTOR_OTHER,
  BUSINESS_TYPE_OPTIONS,
  BUSINESS_TYPE_OTHER,
} from "@/features/business/sectors";

const sectorValues = BUSINESS_SECTOR_OPTIONS.map((item) => item.value) as [
  string,
  ...string[],
];
const typeValues = BUSINESS_TYPE_OPTIONS.map((item) => item.value) as [
  string,
  ...string[],
];
const employeeCountValues = BUSINESS_EMPLOYEE_COUNT_OPTIONS.map(
  (item) => item.value,
) as [string, ...string[]];

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => value ?? "");

const optionalWebsite = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .transform((value) => value ?? "")
  .refine((value) => {
    if (value === "") {
      return true;
    }

    return z.string().url().safeParse(value).success;
  }, "Enter a valid website URL.");

const sectorField = z
  .string()
  .trim()
  .refine(
    (value) => sectorValues.includes(value),
    "Select your business sector.",
  );

const typeField = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .refine(
    (value) => value === "" || typeValues.includes(value),
    "Select a valid business type.",
  );

const employeeCountField = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "")
  .refine(
    (value) => value === "" || employeeCountValues.includes(value),
    "Select a valid team size.",
  );

export const businessProfileSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(2, "Business name must be at least 2 characters.")
      .max(100, "Business name must be at most 100 characters."),
    businessDescription: z
      .string()
      .trim()
      .min(10, "Describe your business in at least 10 characters.")
      .max(1000, "Description must be at most 1000 characters."),
    businessSector: sectorField,
    businessSectorCustom: optionalText(120),
    businessType: typeField,
    businessTypeCustom: optionalText(120),
    phone: optionalText(30),
    email: z
      .string()
      .trim()
      .min(1, "Business email is required.")
      .max(254)
      .email("Enter a valid business email address."),
    address: optionalText(200),
    website: optionalWebsite,
    employeeCount: employeeCountField,
  })
  .superRefine((data, ctx) => {
    if (
      data.businessSector === BUSINESS_SECTOR_OTHER &&
      data.businessSectorCustom.trim().length < 2
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe your sector (at least 2 characters).",
        path: ["businessSectorCustom"],
      });
    }

    if (
      data.businessType === BUSINESS_TYPE_OTHER &&
      data.businessTypeCustom.trim().length < 2
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe your business type (at least 2 characters).",
        path: ["businessTypeCustom"],
      });
    }
  });

export const createBusinessSchema = businessProfileSchema;

export const updateBusinessSchema = businessProfileSchema.extend({
  businessId: z.string().uuid("Invalid business identifier."),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export type BusinessPayload = {
  businessName: string;
  businessDescription: string;
  businessSector: string;
  businessSectorCustom: string;
  businessType: string;
  businessTypeCustom: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  employeeCount: string;
};

export type BusinessErrorCode =
  | "VALIDATION_ERROR"
  | "MISSING_CONFIG"
  | "UNAUTHORIZED"
  | "ALREADY_EXISTS"
  | "NOT_FOUND"
  | "CREATE_FAILED"
  | "UPDATE_FAILED"
  | "LOGO_UPLOAD_FAILED"
  | "LOGO_INVALID";

export type BusinessActionError = {
  code: BusinessErrorCode;
  message: string;
};

export type BusinessActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: BusinessActionError };

export type BusinessProfileData = {
  id: string;
  businessName: string;
  businessDescription: string | null;
  businessSector: string | null;
  businessSectorCustom: string | null;
  businessType: string | null;
  businessTypeCustom: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  employeeCount: string | null;
  logoUrl: string | null;
};

export type CreateBusinessResult = BusinessActionResult<BusinessProfileData>;
export type UpdateBusinessResult = BusinessActionResult<BusinessProfileData>;
export type UploadBusinessLogoResult = BusinessActionResult<{ logoUrl: string }>;

export const BUSINESS_LOGO_FIELD = "logo" as const;

export const ALLOWED_BUSINESS_LOGO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_BUSINESS_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
