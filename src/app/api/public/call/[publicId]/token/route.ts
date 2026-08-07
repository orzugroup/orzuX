import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { startPublicInternetPhoneCall } from "@/services/internet-phone.service";

const bodySchema = z.object({
  visitorId: z.string().trim().min(8).max(64),
});

type RouteContext = {
  params: Promise<{ publicId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { publicId } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid visitor id" }, { status: 400 });
  }

  const result = await startPublicInternetPhoneCall({
    publicId,
    visitorId: parsed.data.visitorId,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(result.data);
}
