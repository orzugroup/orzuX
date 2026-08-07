"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROUTES } from "@/constants/routes";
import { disconnectInternetPhone } from "@/services/internet-phone.service";

export async function disconnectInternetPhoneAction() {
  const result = await disconnectInternetPhone();

  if (result.success) {
    revalidatePath(DASHBOARD_ROUTES.marketplace);
    revalidatePath(`${DASHBOARD_ROUTES.integrations}/internet_phone`);
    revalidatePath(DASHBOARD_ROUTES.integrations);
  }

  return result;
}
