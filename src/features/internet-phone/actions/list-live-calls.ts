"use server";

import { listActiveInternetPhoneCalls } from "@/services/internet-phone.service";
import { getCurrentUser } from "@/services/auth.service";
import { getPrimaryBusiness } from "@/services/business.service";
import type { InternetPhoneLiveCall } from "@/types/internet-phone.types";

export async function listInternetPhoneLiveCallsAction(): Promise<{
  success: boolean;
  calls: InternetPhoneLiveCall[];
  businessId: string | null;
  message?: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, calls: [], businessId: null, message: "Unauthorized" };
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business) {
    return { success: false, calls: [], businessId: null, message: "No business" };
  }

  const calls = await listActiveInternetPhoneCalls(business.id);
  return { success: true, calls, businessId: business.id };
}
