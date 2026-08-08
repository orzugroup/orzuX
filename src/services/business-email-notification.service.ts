import { sendSystemNotificationEmail } from "@/services/email.service";

export async function sendBusinessEmailRegisteredNotification(input: {
  businessId: string;
  businessName: string;
  businessEmail: string;
}): Promise<void> {
  const email = input.businessEmail.trim().toLowerCase();
  if (!email.includes("@")) {
    return;
  }

  const body = `Hello,

This email address was registered as the official business contact email for "${input.businessName}" on OrzuX.

If you manage this business, no action is needed. If you did not expect this message, contact the workspace owner or OrzuX support.`;

  const result = await sendSystemNotificationEmail({
    to: email,
    title: "Your email is linked to OrzuX",
    body,
    previewText: `Business email registered for ${input.businessName}`,
  });

  if (!result.success) {
    console.warn(
      "[business-email] registration notice failed",
      JSON.stringify({
        businessId: input.businessId,
        email,
        message: result.error?.message,
      }),
    );
  }
}
