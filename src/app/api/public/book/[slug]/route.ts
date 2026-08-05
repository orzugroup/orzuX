import { NextResponse } from "next/server";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import {
  getPublicBookingPageSlots,
  submitPublicBooking,
} from "@/services/public-booking.service";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  const data = await getPublicBookingPageSlots(slug, { date });

  if (!data) {
    return NextResponse.json({ success: false, message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    selectedDate: data.selectedDate,
    page: {
      title: data.page.title,
      businessName: data.page.businessName,
      businessTypeLabel: data.page.businessTypeLabel,
      timezone: data.page.bookingTimezone,
      durationMinutes: data.page.slotDurationMinutes,
      advanceBookingDays: data.page.advanceBookingDays,
      weeklySchedule: data.page.weeklySchedule,
      publicUrl: data.page.publicUrl,
      slug: data.page.slug,
    },
    formFields: data.page.formFields,
    resources: data.resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      resourceType: resource.resourceType,
      durationMinutes: resource.durationMinutes,
    })),
    resourceSlots: data.resourceSlots,
    slots: data.slots,
  });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;

    // Distributed rate limit (fails open without Upstash) — prevents booking
    // spam against a public, unauthenticated endpoint.
    const limit = await checkRateLimit({
      key: `public-book:${slug}:${getClientIp(request)}`,
      limit: 10,
      windowSeconds: 60,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(limit.resetSeconds) } },
      );
    }

    const body = await request.json();

    // Bot protection (fails open when Turnstile is not configured). The booking
    // schema strips the extra `turnstileToken` key, so `body` can be passed as-is.
    const turnstileToken = (body as { turnstileToken?: string } | null)
      ?.turnstileToken;
    const turnstile = await verifyTurnstileToken(
      turnstileToken,
      getClientIp(request),
    );

    if (!turnstile.allowed) {
      return NextResponse.json(
        { success: false, message: "Verification failed. Please try again." },
        { status: 400 },
      );
    }

    const result = await submitPublicBooking(slug, body);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not complete booking." },
      { status: 500 },
    );
  }
}
