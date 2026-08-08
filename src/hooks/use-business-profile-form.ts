"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { createBusinessAction } from "@/features/business/actions/create-business";
import { updateBusinessAction } from "@/features/business/actions/update-business";
import { BUSINESS_MESSAGES } from "@/features/business/constants";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/constants";
import type {
  BusinessProfileData,
  BusinessProfileInput,
  CreateBusinessResult,
  UpdateBusinessResult,
} from "@/types/business.types";

type UseBusinessProfileFormOptions = {
  businessId?: string;
  onCreateSuccess?: (business: BusinessProfileData) => void;
  onUpdateSuccess?: (business: BusinessProfileData) => void;
};

export function useBusinessProfileForm({
  businessId,
  onCreateSuccess,
  onUpdateSuccess,
}: UseBusinessProfileFormOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const isEditMode = Boolean(businessId);

  const save = useCallback(
    async (
      input: BusinessProfileInput,
    ): Promise<CreateBusinessResult | UpdateBusinessResult> => {
      setIsLoading(true);

      try {
        const result = isEditMode
          ? await updateBusinessAction(businessId!, input)
          : await createBusinessAction(input);

        if (result.success) {
          toast.success(
            isEditMode
              ? BUSINESS_MESSAGES.updateSuccess
              : BUSINESS_MESSAGES.createSuccess,
          );

          if (!isEditMode && input.email.trim()) {
            toast.message(ONBOARDING_MESSAGES.businessEmailSentToast, {
              description: input.email.trim(),
            });
          }

          if (isEditMode) {
            onUpdateSuccess?.(result.data);
          } else {
            onCreateSuccess?.(result.data);
          }

          return result;
        }

        toast.error(result.error.message);
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [businessId, isEditMode, onCreateSuccess, onUpdateSuccess],
  );

  return {
    save,
    isLoading,
    isEditMode,
  };
}
