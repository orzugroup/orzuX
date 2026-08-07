"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_ROUTES } from "@/constants/routes";
import { connectInternetPhone } from "@/services/internet-phone.service";

export async function connectInternetPhoneAction() {
  const result = await connectInternetPhone();

  if (result.success) {
    revalidatePath(DASHBOARD_ROUTES.marketplace);
    revalidatePath(`${DASHBOARD_ROUTES.integrations}/internet_phone`);
    revalidatePath(DASHBOARD_ROUTES.integrations);
  }

  return result;
}
