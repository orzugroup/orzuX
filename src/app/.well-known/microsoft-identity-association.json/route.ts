import { NextResponse } from "next/server";

/**
 * Microsoft Entra publisher-domain verification.
 * Must return HTTP 200 (not 301/308) at:
 * https://orzux.com/.well-known/microsoft-identity-association.json
 */
const BODY = {
  associatedApplications: [
    {
      applicationId: "be463a95-e627-407f-bc31-2ff1ab487ba1",
    },
  ],
} as const;

export async function GET() {
  return NextResponse.json(BODY, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": "application/json",
    },
  });
}
