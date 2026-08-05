"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AiSidebarNavGroup } from "@/components/dashboard/AiSidebarNavGroup";
import { SidebarExpandToggle } from "@/components/dashboard/SidebarExpandToggle";
import { BrandMark } from "@/components/brand/BrandMark";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { BRAND_NAME } from "@/constants/brand";
import {
  buildDashboardNavItems,
  DASHBOARD_NAV_ITEMS,
} from "@/features/dashboard/constants";
import { SIDEBAR_NAV_BUTTON_CLASS } from "@/features/navigation/sidebar-nav-ui";
import { useDashboardNavBadges } from "@/hooks/use-dashboard-nav-badges";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { DashboardUserProfile } from "@/types/dashboard.types";

import { UserProfileSection } from "./UserProfileSection";
import { AiHumanRequestsButton } from "./AiHumanRequestsButton";
import { PlatformCopilotSidebarButton } from "./PlatformCopilotSidebarButton";

const EXPANDED_STORAGE_KEY = "orzu-sidebar-expanded";

type AppSidebarProps = {
  userProfile: DashboardUserProfile;
  googleCalendarConnected?: boolean;
};

function getNavBadgeCount(
  itemId: string,
  counts: ReturnType<typeof useDashboardNavBadges>["counts"],
): number {
  if (itemId === "chats") {
    return counts.inboxUnread;
  }

  if (itemId === "calendar") {
    return (
      counts.calendarAiUnread + counts.overdueTasks + counts.upcomingEvents
    );
  }

  if (itemId === "contacts") {
    return counts.crmUnread + counts.overdueTasks;
  }

  return 0;
}

function readStoredExpanded(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(EXPANDED_STORAGE_KEY) !== "0";
}

function AppSidebarInner({
  userProfile,
  googleCalendarConnected = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { counts } = useDashboardNavBadges();
  const { open, setOpen, isMobile } = useSidebar();
  const navItems = buildDashboardNavItems({ googleCalendarConnected });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const expanded = readStoredExpanded();
    setHydrated(true);
    if (!isMobile) {
      setOpen(expanded);
    }
  }, [isMobile, setOpen]);

  const handleToggleExpanded = useCallback(() => {
    const next = !open;
    setOpen(next);
    window.localStorage.setItem(EXPANDED_STORAGE_KEY, next ? "1" : "0");
  }, [open, setOpen]);

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      className="border-r border-sidebar-border/70 bg-sidebar/90"
    >
      <SidebarHeader className="gap-0 border-b border-sidebar-border/70 p-2 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              tooltip={BRAND_NAME}
              className="h-12 text-sidebar-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!"
            >
              <Link
                href={DASHBOARD_NAV_ITEMS[0].href}
                className="flex w-full items-center gap-2 overflow-hidden group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
              >
                <BrandMark
                  size={36}
                  className="size-9 shrink-0 transition-[width,height] duration-200 ease-linear group-data-[collapsible=icon]:size-7"
                />
                <BrandWordmark className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase text-sidebar-foreground/55">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                if (item.id === "ai-assistant") {
                  return <AiSidebarNavGroup key={item.id} pathname={pathname} />;
                }

                const isActive =
                  item.href === DASHBOARD_NAV_ITEMS[0].href
                    ? pathname === item.href
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                const badgeCount = getNavBadgeCount(item.id, counts);

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={SIDEBAR_NAV_BUTTON_CLASS}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                        {badgeCount > 0 ? (
                          <SidebarMenuBadge>
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </SidebarMenuBadge>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 bg-sidebar/70">
        <PlatformCopilotSidebarButton />
        <AiHumanRequestsButton />
        {hydrated ? (
          <SidebarExpandToggle
            isExpanded={open}
            onToggle={handleToggleExpanded}
          />
        ) : null}
        <UserProfileSection userProfile={userProfile} />
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  return <AppSidebarInner {...props} />;
}
