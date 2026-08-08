import { APP_ROUTES, AUTH_ROUTES } from "@/constants/routes";

/** Route matchers safe for Edge middleware — no env or secrets imports. */

export function isProtectedRoute(pathname: string): boolean {
  return pathname === APP_ROUTES.dashboard || pathname.startsWith("/dashboard/");
}

export function isAuthEntryRoute(pathname: string): boolean {
  return (
    pathname === AUTH_ROUTES.login ||
    pathname === AUTH_ROUTES.register ||
    pathname === AUTH_ROUTES.forgotPassword
  );
}

export function isPublicAuthFlowRoute(pathname: string): boolean {
  return (
    pathname === AUTH_ROUTES.callback ||
    pathname === AUTH_ROUTES.confirm ||
    pathname === AUTH_ROUTES.google ||
    pathname === AUTH_ROUTES.verifySuccess ||
    pathname === AUTH_ROUTES.authCodeError ||
    pathname === AUTH_ROUTES.registerConfirmation ||
    pathname === AUTH_ROUTES.forgotPasswordConfirmation ||
    pathname === AUTH_ROUTES.magicLinkConfirmation ||
    pathname === AUTH_ROUTES.resetPasswordSuccess ||
    pathname.startsWith("/auth/register/") ||
    pathname.startsWith("/auth/forgot-password/")
  );
}
