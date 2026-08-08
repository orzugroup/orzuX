import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { APP_ROUTES, AUTH_ROUTES } from "@/constants/routes";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

type AuthCodeErrorPageProps = {
  searchParams: Promise<{
    message?: string;
  }>;
};

export default async function AuthCodeErrorPage({
  searchParams,
}: AuthCodeErrorPageProps) {
  const params = await searchParams;
  const rawMessage =
    params.message ??
    "We could not complete your sign-in. Please try again.";
  const isVerificationError =
    rawMessage.toLowerCase().includes("expired") ||
    (rawMessage.toLowerCase().includes("invalid") &&
      rawMessage.toLowerCase().includes("token") &&
      !rawMessage.toLowerCase().includes("pkce"));
  const isPkceError = rawMessage.toLowerCase().includes("pkce");

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {isVerificationError
              ? "Verification link expired"
              : isPkceError
                ? "Google sign-in interrupted"
                : "Sign-in failed"}
          </CardTitle>
          <CardDescription>
            {isPkceError
              ? "Please tap Continue with Google again to finish signing in."
              : rawMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isVerificationError ? (
            <>
              <p className="text-center text-sm text-muted-foreground">
                Open the registration page, enter the{" "}
                <strong>6-digit code</strong> from your latest email, or tap
                &quot;Resend verification email&quot; for a new code and link.
              </p>
              <Button asChild className="w-full">
                <Link href={AUTH_ROUTES.registerConfirmation}>
                  Enter verification code
                </Link>
              </Button>
            </>
          ) : null}
          <GoogleSignInButton />
          <Button asChild variant="ghost" className="w-full">
            <Link href={APP_ROUTES.home}>Back to home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
