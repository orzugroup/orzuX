"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  Building2Icon,
  CreditCardIcon,
  HeadphonesIcon,
  Loader2Icon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useDashboardProfile } from "@/contexts/dashboard-profile-context";
import { usePlatformSupport } from "@/contexts/platform-support-context";
import { DASHBOARD_ROUTES } from "@/constants/routes";
import { signOutAction } from "@/features/auth/actions/sign-out";
import { prepareBrowserSignOut } from "@/lib/supabase/client-sign-out";
import {
  ACCOUNT_SETTINGS_MESSAGES,
  SETTINGS_MESSAGES,
} from "@/features/settings/constants";
import { cn } from "@/lib/utils";
import { getUserDisplayName, getUserInitials } from "@/utils/dashboard";

/** Compact account menu for mobile header (top-right). */
export function MobileAccountMenu() {
  const pathname = usePathname();
  const userProfile = useDashboardProfile();
  const [isSigningOut, startSignOutTransition] = useTransition();
  const { toggle: toggleSupport, unreadCount: supportUnreadCount } =
    usePlatformSupport();

  if (!userProfile) {
    return null;
  }

  const displayName = getUserDisplayName(
    userProfile.fullName,
    userProfile.email,
  );
  const initials = getUserInitials(userProfile.fullName, userProfile.email);
  const isAccountPage = pathname === DASHBOARD_ROUTES.account;
  const isProfilePage = pathname === DASHBOARD_ROUTES.profile;
  const isSettingsPage =
    pathname === DASHBOARD_ROUTES.settings ||
    pathname.startsWith(`${DASHBOARD_ROUTES.settings}/`);
  const isBillingPage =
    pathname === DASHBOARD_ROUTES.subscription ||
    pathname.startsWith(`${DASHBOARD_ROUTES.subscription}/`);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative size-9 shrink-0 rounded-full"
          aria-label="Account"
        >
          <Avatar className="size-8">
            {userProfile.avatarUrl ? (
              <AvatarImage src={userProfile.avatarUrl} alt={displayName} />
            ) : null}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          {supportUnreadCount > 0 ? (
            <span className="absolute right-0 top-0 size-2 rounded-full bg-primary" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56 rounded-lg" align="end" sideOffset={8}>
        <DropdownMenuLabel className="p-0 font-normal">
          <Link
            href={DASHBOARD_ROUTES.account}
            className={cn(
              "flex items-center gap-2 rounded-sm px-2 py-2 text-left text-sm transition-colors hover:bg-accent",
              isAccountPage && "bg-primary/10",
            )}
          >
            <Avatar className="size-8">
              {userProfile.avatarUrl ? (
                <AvatarImage src={userProfile.avatarUrl} alt={displayName} />
              ) : null}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {userProfile.email}
              </span>
            </div>
          </Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-muted-foreground">
          Current plan: {userProfile.plan}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className={cn(isProfilePage && "bg-accent font-medium")}
        >
          <Link href={DASHBOARD_ROUTES.profile}>
            <Building2Icon className="size-4" />
            {ACCOUNT_SETTINGS_MESSAGES.profileNav}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className={cn(isAccountPage && "bg-accent font-medium")}
        >
          <Link href={DASHBOARD_ROUTES.account}>
            <UserIcon className="size-4" />
            {ACCOUNT_SETTINGS_MESSAGES.accountNav}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className={cn(isSettingsPage && "bg-accent font-medium")}
        >
          <Link href={DASHBOARD_ROUTES.settings}>
            <SettingsIcon className="size-4" />
            {SETTINGS_MESSAGES.pageTitle}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          asChild
          className={cn(isBillingPage && "bg-accent font-medium")}
        >
          <Link href={DASHBOARD_ROUTES.subscription}>
            <CreditCardIcon className="size-4" />
            Billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            toggleSupport();
          }}
        >
          <HeadphonesIcon className="size-4" />
          <span className="flex-1">Support</span>
          {supportUnreadCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
              {supportUnreadCount > 99 ? "99+" : supportUnreadCount}
            </span>
          ) : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isSigningOut}
          onSelect={(event) => {
            event.preventDefault();
            startSignOutTransition(async () => {
              prepareBrowserSignOut();
              await signOutAction();
            });
          }}
        >
          {isSigningOut ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <LogOutIcon className="size-4" />
          )}
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
