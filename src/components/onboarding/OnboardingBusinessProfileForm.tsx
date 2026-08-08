"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/constants";
import {
  BUSINESS_EMPLOYEE_COUNT_OPTIONS,
  BUSINESS_SECTOR_OPTIONS,
  BUSINESS_SECTOR_OTHER,
  BUSINESS_TYPE_OPTIONS,
  BUSINESS_TYPE_OTHER,
} from "@/features/business/sectors";
import { useBusinessProfileForm } from "@/hooks/use-business-profile-form";
import { cn } from "@/lib/utils";
import type { BusinessProfileData, BusinessProfileInput } from "@/types/business.types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm";

type FormErrors = Partial<Record<keyof BusinessProfileInput, string>>;

type OnboardingBusinessProfileFormProps = {
  business?: BusinessProfileData | null;
  defaultBusinessName?: string;
  /** Denser one-screen layout for first-login onboarding. */
  compact?: boolean;
  onSuccess?: () => void;
};

export function OnboardingBusinessProfileForm({
  business,
  defaultBusinessName,
  compact = false,
  onSuccess,
}: OnboardingBusinessProfileFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [sector, setSector] = useState(business?.businessSector ?? "");
  const [sectorCustom, setSectorCustom] = useState(
    business?.businessSectorCustom ?? "",
  );
  const [businessType, setBusinessType] = useState(business?.businessType ?? "");
  const [businessTypeCustom, setBusinessTypeCustom] = useState(
    business?.businessTypeCustom ?? "",
  );
  const [employeeCount, setEmployeeCount] = useState(
    business?.employeeCount ?? "",
  );

  const { save, isLoading, isEditMode } = useBusinessProfileForm({
    businessId: business?.id,
    onCreateSuccess: () => {
      router.refresh();
      onSuccess?.();
    },
    onUpdateSuccess: () => {
      router.refresh();
      onSuccess?.();
    },
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const input: BusinessProfileInput = {
      businessName: String(formData.get("businessName") ?? ""),
      businessDescription: String(formData.get("businessDescription") ?? ""),
      businessSector: sector || String(formData.get("businessSector") ?? ""),
      businessSectorCustom:
        sectorCustom || String(formData.get("businessSectorCustom") ?? ""),
      businessType: businessType || String(formData.get("businessType") ?? ""),
      businessTypeCustom:
        businessTypeCustom || String(formData.get("businessTypeCustom") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      address: String(formData.get("address") ?? ""),
      website: String(formData.get("website") ?? ""),
      employeeCount:
        employeeCount || String(formData.get("employeeCount") ?? ""),
    };

    const result = await save(input);

    if (!result.success && result.error.code === "VALIDATION_ERROR") {
      const message = result.error.message.toLowerCase();
      const next: FormErrors = {};

      if (message.includes("business name")) next.businessName = result.error.message;
      else if (message.includes("description")) {
        next.businessDescription = result.error.message;
      } else if (message.includes("email")) next.email = result.error.message;
      else if (message.includes("sector")) {
        if (message.includes("describe")) next.businessSectorCustom = result.error.message;
        else next.businessSector = result.error.message;
      } else if (message.includes("type")) {
        if (message.includes("describe")) next.businessTypeCustom = result.error.message;
        else next.businessType = result.error.message;
      } else if (message.includes("website") || message.includes("url")) {
        next.website = result.error.message;
      } else if (message.includes("employee")) {
        next.employeeCount = result.error.message;
      }

      setErrors(next);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col",
        compact ? "gap-3" : "gap-5",
      )}
      noValidate
    >
      <div
        className={cn(
          "min-h-0 flex-1 space-y-3",
          compact ? "overflow-y-auto md:overflow-hidden" : "space-y-5 overflow-y-auto",
        )}
      >
        <div className={cn("grid gap-3", compact ? "md:grid-cols-2" : "gap-4")}>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="onboarding-business-name">
              Business name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="onboarding-business-name"
              name="businessName"
              className={compact ? "h-9" : undefined}
              defaultValue={business?.businessName ?? defaultBusinessName ?? ""}
              placeholder="Acme Coffee Shop"
              required
              aria-invalid={Boolean(errors.businessName)}
            />
            {errors.businessName ? (
              <p className="text-xs text-destructive">{errors.businessName}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="onboarding-business-sector">
              {ONBOARDING_MESSAGES.sectorLabel}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <select
              id="onboarding-business-sector"
              name="businessSector"
              className={selectClassName}
              value={sector}
              required
              aria-invalid={Boolean(errors.businessSector)}
              onChange={(event) => setSector(event.target.value)}
            >
              <option value="" disabled>
                Select sector
              </option>
              {BUSINESS_SECTOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.businessSector ? (
              <p className="text-xs text-destructive">{errors.businessSector}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="onboarding-business-email">
              Business email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="onboarding-business-email"
              name="email"
              type="email"
              className={compact ? "h-9" : undefined}
              defaultValue={business?.email ?? ""}
              placeholder="hello@business.com"
              required
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email}</p>
            ) : null}
          </div>

          {sector === BUSINESS_SECTOR_OTHER ? (
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="onboarding-sector-custom">
                {ONBOARDING_MESSAGES.sectorCustomLabel}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="onboarding-sector-custom"
                name="businessSectorCustom"
                className={compact ? "h-9" : undefined}
                value={sectorCustom}
                onChange={(event) => setSectorCustom(event.target.value)}
                placeholder={ONBOARDING_MESSAGES.sectorCustomPlaceholder}
                required
                aria-invalid={Boolean(errors.businessSectorCustom)}
              />
              {errors.businessSectorCustom ? (
                <p className="text-xs text-destructive">
                  {errors.businessSectorCustom}
                </p>
              ) : null}
            </div>
          ) : (
            <input type="hidden" name="businessSectorCustom" value={sectorCustom} />
          )}

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="onboarding-business-description">
              Business description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="onboarding-business-description"
              name="businessDescription"
              defaultValue={business?.businessDescription ?? ""}
              placeholder="What do you offer, who are your customers, and what makes you different?"
              rows={compact ? 3 : 4}
              className={compact ? "min-h-[4.5rem] resize-none" : undefined}
              required
              aria-invalid={Boolean(errors.businessDescription)}
            />
            {errors.businessDescription ? (
              <p className="text-xs text-destructive">
                {errors.businessDescription}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ONBOARDING_MESSAGES.sectionOptionalDetails}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {ONBOARDING_MESSAGES.optionalFieldsHint}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-business-type">
                {ONBOARDING_MESSAGES.typeLabel}
              </Label>
              <select
                id="onboarding-business-type"
                name="businessType"
                className={selectClassName}
                value={businessType}
                onChange={(event) => setBusinessType(event.target.value)}
              >
                <option value="">Not set</option>
                {BUSINESS_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="onboarding-employee-count">
                {ONBOARDING_MESSAGES.employeeCountLabel}
              </Label>
              <select
                id="onboarding-employee-count"
                name="employeeCount"
                className={selectClassName}
                value={employeeCount}
                aria-invalid={Boolean(errors.employeeCount)}
                onChange={(event) => setEmployeeCount(event.target.value)}
              >
                <option value="">Not set</option>
                {BUSINESS_EMPLOYEE_COUNT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.employeeCount ? (
                <p className="text-xs text-destructive">{errors.employeeCount}</p>
              ) : null}
            </div>

            {businessType === BUSINESS_TYPE_OTHER ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="onboarding-type-custom">
                  {ONBOARDING_MESSAGES.typeCustomLabel}
                </Label>
                <Input
                  id="onboarding-type-custom"
                  name="businessTypeCustom"
                  className={compact ? "h-9" : undefined}
                  value={businessTypeCustom}
                  onChange={(event) => setBusinessTypeCustom(event.target.value)}
                  placeholder={ONBOARDING_MESSAGES.typeCustomPlaceholder}
                />
              </div>
            ) : (
              <input
                type="hidden"
                name="businessTypeCustom"
                value={businessTypeCustom}
              />
            )}

            <div className="space-y-1.5">
              <Label htmlFor="onboarding-business-phone">Phone</Label>
              <Input
                id="onboarding-business-phone"
                name="phone"
                type="tel"
                className={compact ? "h-9" : undefined}
                defaultValue={business?.phone ?? ""}
                placeholder="+1 555 0100"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="onboarding-business-website">Website</Label>
              <Input
                id="onboarding-business-website"
                name="website"
                type="url"
                className={compact ? "h-9" : undefined}
                defaultValue={business?.website ?? ""}
                placeholder="https://yourbusiness.com"
                aria-invalid={Boolean(errors.website)}
              />
              {errors.website ? (
                <p className="text-xs text-destructive">{errors.website}</p>
              ) : null}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="onboarding-business-address">Address</Label>
              <Input
                id="onboarding-business-address"
                name="address"
                className={compact ? "h-9" : undefined}
                defaultValue={business?.address ?? ""}
                placeholder="123 Main Street, City"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t pt-3">
        <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Saving...
            </>
          ) : isEditMode ? (
            ONBOARDING_MESSAGES.submitUpdate
          ) : (
            ONBOARDING_MESSAGES.submitCreate
          )}
        </Button>
      </div>
    </form>
  );
}
