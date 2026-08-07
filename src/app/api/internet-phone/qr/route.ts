import { NextResponse } from "next/server";

import { buildInternetPhoneQrDataUrl } from "@/lib/internet-phone/print-assets";
import { getCurrentUser } from "@/services/auth.service";
import { getPrimaryBusiness } from "@/services/business.service";
import { getInternetPhoneConnection } from "@/services/internet-phone.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = await getPrimaryBusiness(user.id);
  if (!business) {
    return NextResponse.json({ error: "No business" }, { status: 400 });
  }

  const connection = await getInternetPhoneConnection(business.id);
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "Not connected" }, { status: 404 });
  }

  const dataUrl = await buildInternetPhoneQrDataUrl(connection.publicUrl);
  return NextResponse.json({ dataUrl, publicUrl: connection.publicUrl });
}
