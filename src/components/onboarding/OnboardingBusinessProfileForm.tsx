"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import { OnboardingChoiceGrid } from "@/components/onboarding/OnboardingChoiceGrid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/constants";
import {
  BUSINESS_SECTOR_OPTIONS,
  BUSINESS_SECTOR_OTHER,
  BUSINESS_TYPE_OPTIONS,
  BUSINESS_TYPE_OTHER,
} from "@/features/business/sectors";
import { useBusinessProfileForm } from "@/hooks/use-business-profile-form";
import type { BusinessProfileData, BusinessProfileInput } from "@/types/business.types";

type FormErrors = Partial<Record<keyof BusinessProfileInput, string>>;

type OnboardingBusinessProfileFormProps = {
  business?: BusinessProfileData | null;
  defaultBusinessName?: string;
  /** First-login onboarding: required fields only (no phone/website/address). */
  requiredFieldsOnly?: boolean;
  onSuccess?: () => void;
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function OnboardingBusinessProfileForm({
  business,
  defaultBusinessName,
  requiredFieldsOnly = false,
  onSuccess,
}: OnboardingBusinessProfileFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [sector, setSector] = useState(business?.businessSector ?? "");
  const [businessType, setBusinessType] = useState(business?.businessType ?? "");

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

  const showSectorCustom = sector === BUSINESS_SECTOR_OTHER;
  const showTypeCustom = businessType === BUSINESS_TYPE_OTHER;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const input: BusinessProfileInput = {
      businessName: String(formData.get("businessName") ?? ""),
      businessDescription: String(formData.get("businessDescription") ?? ""),
      businessSector: sector || String(formData.get("businessSector") ?? ""),
      businessSectorCustom: String(formData.get("businessSectorCustom") ?? ""),
      businessType: businessType || String(formData.get("businessType") ?? ""),
      businessTypeCustom: String(formData.get("businessTypeCustom") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      address: String(formData.get("address") ?? ""),
      website: String(formData.get("website") ?? ""),
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
      }

      setErrors(next);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      className="space-y-2"
      noValidate
    >
      <FormSection title={ONBOARDING_MESSAGES.sectionIdentity}>
        <div className="space-y-2">
          <Label htmlFor="onboarding-business-name">
            Business name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="onboarding-business-name"
            name="businessName"
            defaultValue={business?.businessName ?? defaultBusinessName ?? ""}
            placeholder="Acme Coffee Shop"
            required
            aria-invalid={Boolean(errors.businessName)}
          />
          {errors.businessName ? (
            <p className="text-xs text-destructive">{errors.businessName}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="onboarding-business-description">
            Business description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="onboarding-business-description"
            name="businessDescription"
            defaultValue={business?.businessDescription ?? ""}
            placeholder="What do you offer, who are your customers, and what makes you different?"
            rows={4}
            required
            aria-invalid={Boolean(errors.businessDescription)}
          />
          {errors.businessDescription ? (
            <p className="text-xs text-destructive">{errors.businessDescription}</p>
          ) : null}
        </div>
      </FormSection>

      <FormSection title={ONBOARDING_MESSAGES.sectionIndustry}>
        <div className="space-y-2">
          <Label>
            {ONBOARDING_MESSAGES.sectorLabel}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <OnboardingChoiceGrid
            name="businessSector"
            options={BUSINESS_SECTOR_OPTIONS}
            value={sector}
            onChange={setSector}
            invalid={Boolean(errors.businessSector)}
            columns={2}
          />
          {errors.businessSector ? (
            <p className="text-xs text-destructive">{errors.businessSector}</p>
          ) : null}
        </div>

        {showSectorCustom ? (
          <div className="space-y-2">
            <Label htmlFor="onboarding-sector-custom">
              {ONBOARDING_MESSAGES.sectorCustomLabel}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="onboarding-sector-custom"
              name="businessSectorCustom"
              defaultValue={business?.businessSectorCustom ?? ""}
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
        ) : null}

        <div className="space-y-2">
          <Label>
            {ONBOARDING_MESSAGES.typeLabel}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <OnboardingChoiceGrid
            name="businessType"
            options={BUSINESS_TYPE_OPTIONS}
            value={businessType}
            onChange={setBusinessType}
            invalid={Boolean(errors.businessType)}
            columns={2}
          />
          {errors.businessType ? (
            <p className="text-xs text-destructive">{errors.businessType}</p>
          ) : null}
        </div>

        {showTypeCustom ? (
          <div className="space-y-2">
            <Label htmlFor="onboarding-type-custom">
              {ONBOARDING_MESSAGES.typeCustomLabel}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="onboarding-type-custom"
              name="businessTypeCustom"
              defaultValue={business?.businessTypeCustom ?? ""}
              placeholder={ONBOARDING_MESSAGES.typeCustomPlaceholder}
              required
              aria-invalid={Boolean(errors.businessTypeCustom)}
            />
            {errors.businessTypeCustom ? (
              <p className="text-xs text-destructive">{errors.businessTypeCustom}</p>
            ) : null}
          </div>
        ) : null}
      </FormSection>

      <FormSection title={ONBOARDING_MESSAGES.sectionContact}>
        <div className="space-y-2">
          <Label htmlFor="onboarding-business-email">
            Business email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="onboarding-business-email"
            name="email"
            type="email"
            defaultValue={business?.email ?? ""}
            placeholder="hello@business.com"
            required
            aria-invalid={Boolean(errors.email)}
          />
          <p className="text-xs text-muted-foreground">
            {ONBOARDING_MESSAGES.businessEmailHint}
          </p>
          {errors.email ? (
            <p className="text-xs text-destructive">{errors.email}</p>
          ) : null}
        </div>
      </FormSection>

      {!requiredFieldsOnly ? (
        <FormSection title={ONBOARDING_MESSAGES.sectionOptionalDetails}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="onboarding-business-phone">Phone</Label>
              <Input
                id="onboarding-business-phone"
                name="phone"
                type="tel"
                defaultValue={business?.phone ?? ""}
                placeholder="+1 555 0100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboarding-business-website">Website</Label>
              <Input
                id="onboarding-business-website"
                name="website"
                type="url"
                defaultValue={business?.website ?? ""}
                placeholder="https://yourbusiness.com"
                aria-invalid={Boolean(errors.website)}
              />
              {errors.website ? (
                <p className="text-xs text-destructive">{errors.website}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="onboarding-business-address">Address</Label>
            <Input
              id="onboarding-business-address"
              name="address"
              defaultValue={business?.address ?? ""}
              placeholder="123 Main Street, City"
            />
          </div>
        </FormSection>
      ) : null}

      <div className="border-t pt-6">
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
