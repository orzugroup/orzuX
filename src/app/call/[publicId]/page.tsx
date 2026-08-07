import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicCallClient } from "@/components/internet-phone/PublicCallClient";
import { INTERNET_PHONE_MESSAGES } from "@/features/internet-phone/constants";
import { getPublicInternetPhonePage } from "@/services/internet-phone.service";

type PublicCallPageProps = {
  params: Promise<{ publicId: string }>;
};

export async function generateMetadata({
  params,
}: PublicCallPageProps): Promise<Metadata> {
  const { publicId } = await params;
  const page = await getPublicInternetPhonePage(publicId);

  if (!page) {
    return { title: INTERNET_PHONE_MESSAGES.publicUnavailable };
  }

  return {
    title: `Call ${page.displayName}`,
    description: page.greetingMessage,
    robots: { index: false, follow: false },
  };
}

export default async function PublicCallPage({ params }: PublicCallPageProps) {
  const { publicId } = await params;
  const page = await getPublicInternetPhonePage(publicId);

  if (!page) {
    notFound();
  }

  return <PublicCallClient page={page} />;
}
