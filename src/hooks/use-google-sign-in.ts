"use client";

import { useCallback, useState } from "react";

import { AUTH_ROUTES } from "@/constants/routes";
import { getSafeRedirectPath } from "@/utils/auth-redirect";

type UseGoogleSignInOptions = {
  nextPath?: string;
  onError?: (message: string) => void;
};

/**
 * Navigate to /auth/google so PKCE verifier cookies are set on the
 * same HTTP redirect response that sends the browser to Google.
 * Do not start OAuth from a Server Action — that breaks first-attempt login.
 */
export function useGoogleSignIn(options: UseGoogleSignInOptions = {}) {
  const { nextPath, onError } = options;
  const [isLoading, setIsLoading] = useState(false);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL(AUTH_ROUTES.google, window.location.origin);
      url.searchParams.set("next", getSafeRedirectPath(nextPath));
      window.location.assign(url.toString());
    } catch (error) {
      setIsLoading(false);
      onError?.(
        error instanceof Error
          ? error.message
          : "Unable to start Google sign-in.",
      );
    }
  }, [nextPath, onError]);

  return {
    signIn,
    isLoading,
  };
}
