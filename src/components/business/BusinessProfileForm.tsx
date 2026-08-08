"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_MESSAGES } from "@/features/business/constants";
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
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

type BusinessProfileFormProps = {
  business?: BusinessProfileData | null;
  defaultBusinessName?: string;
  className?: string;
  onSuccess?: () => void;
};

type FormErrors = Partial<Record<keyof BusinessProfileInput, string>>;

export function BusinessProfileForm({
  business,
  defaultBusinessName,
  className,
  onSuccess,
}: BusinessProfileFormProps) {
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [sector, setSector] = useState(business?.businessSector ?? "");
  const [businessType, setBusinessType] = useState(business?.businessType ?? "");
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
    const result = await save({
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
      employeeCount:
        employeeCount || String(formData.get("employeeCount") ?? ""),
    });

    if (!result.success && result.error.code === "VALIDATION_ERROR") {
      const message = result.error.message.toLowerCase();
      if (message.includes("business name")) setErrors({ businessName: result.error.message });
      else if (message.includes("email")) setErrors({ email: result.error.message });
      else if (message.includes("website") || message.includes("url")) setErrors({ website: result.error.message });
      else if (message.includes("description")) setErrors({ businessDescription: result.error.message });
      else if (message.includes("sector")) setErrors({ businessSector: result.error.message });
      else if (message.includes("type")) setErrors({ businessType: result.error.message });
    }
  }

  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader>
        <CardTitle>
          {isEditMode ? BUSINESS_MESSAGES.editTitle : BUSINESS_MESSAGES.createTitle}
        </CardTitle>
        <CardDescription>
          {isEditMode
            ? BUSINESS_MESSAGES.editDescription
            : BUSINESS_MESSAGES.createDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="business-name">Business name *</Label>
            <Input
              id="business-name"
              name="businessName"
              defaultValue={business?.businessName ?? defaultBusinessName ?? ""}
              required
              aria-invalid={Boolean(errors.businessName)}
            />
            {errors.businessName ? (
              <p className="text-xs text-destructive">{errors.businessName}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business-sector">Industry / sector *</Label>
              <select
                id="business-sector"
                name="businessSector"
                className={selectClassName}
                value={sector}
                required
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-type">Business type</Label>
              <select
                id="business-type"
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
          </div>

          {sector === BUSINESS_SECTOR_OTHER ? (
            <div className="space-y-2">
              <Label htmlFor="business-sector-custom">Custom sector *</Label>
              <Input
                id="business-sector-custom"
                name="businessSectorCustom"
                defaultValue={business?.businessSectorCustom ?? ""}
              />
            </div>
          ) : null}

          {businessType === BUSINESS_TYPE_OTHER ? (
            <div className="space-y-2">
              <Label htmlFor="business-type-custom">Custom business type *</Label>
              <Input
                id="business-type-custom"
                name="businessTypeCustom"
                defaultValue={business?.businessTypeCustom ?? ""}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="business-description">Description *</Label>
            <Textarea
              id="business-description"
              name="businessDescription"
              defaultValue={business?.businessDescription ?? ""}
              rows={4}
              aria-invalid={Boolean(errors.businessDescription)}
            />
            {errors.businessDescription ? (
              <p className="text-xs text-destructive">{errors.businessDescription}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business-email">Business email *</Label>
              <Input
                id="business-email"
                name="email"
                type="email"
                defaultValue={business?.email ?? ""}
                required
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-phone">Phone</Label>
              <Input
                id="business-phone"
                name="phone"
                type="tel"
                defaultValue={business?.phone ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-address">Address</Label>
            <Input
              id="business-address"
              name="address"
              defaultValue={business?.address ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="business-website">Website</Label>
              <Input
                id="business-website"
                name="website"
                type="url"
                defaultValue={business?.website ?? ""}
                aria-invalid={Boolean(errors.website)}
              />
              {errors.website ? (
                <p className="text-xs text-destructive">{errors.website}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="business-employee-count">Team size</Label>
              <select
                id="business-employee-count"
                name="employeeCount"
                className={selectClassName}
                value={employeeCount}
                onChange={(event) => setEmployeeCount(event.target.value)}
              >
                <option value="">Not set</option>
                {BUSINESS_EMPLOYEE_COUNT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Saving...
              </>
            ) : isEditMode ? (
              "Save changes"
            ) : (
              "Create business profile"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
