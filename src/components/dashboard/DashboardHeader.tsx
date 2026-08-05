"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { InboxToolbar } from "@/components/chats/inbox/InboxToolbar";
import { AiAssistantToolbar } from "@/components/ai-assistant/AiAssistantToolbar";
import { CalendarToolbar } from "@/components/orzux-calendar/CalendarToolbar";
import { useOptionalCalendarChrome } from "@/components/orzux-calendar/calendar-chrome-context";
import { ContactsToolbar } from "@/components/contacts/ContactsToolbar";
import { CrmEntityTabs } from "@/components/contacts/CrmEntityTabs";
import { useOptionalAiAssistantChrome } from "@/components/ai-assistant/ai-assistant-chrome-context";
import { useOptionalContactsChrome } from "@/components/contacts/contacts-chrome-context";
import { useOptionalInboxChrome } from "@/components/chats/inbox/use-optional-inbox-chrome";
import { OrdersToolbar } from "@/components/orders/OrdersToolbar";
import { useOptionalOrdersChrome } from "@/components/orders/orders-chrome-context";
import { DashboardPageHeading } from "@/components/dashboard/DashboardPageHeading";
import { DASHBOARD_ROUTES } from "@/constants/routes";
import { getDashboardPageHeaderMeta } from "@/features/dashboard/page-header-meta";
import { cn } from "@/lib/utils";

function isInboxPath(pathname: string): boolean {
  return (
    pathname === DASHBOARD_ROUTES.chats ||
    pathname.startsWith(`${DASHBOARD_ROUTES.chats}/`)
  );
}

function isContactsPath(pathname: string): boolean {
  return pathname === DASHBOARD_ROUTES.contacts;
}

function isAiAssistantPath(pathname: string): boolean {
  return pathname === DASHBOARD_ROUTES.aiAssistant;
}

function isCalendarPath(pathname: string): boolean {
  return (
    pathname === DASHBOARD_ROUTES.calendar ||
    pathname.startsWith(`${DASHBOARD_ROUTES.calendar}/`)
  );
}

function isOrdersPath(pathname: string): boolean {
  return (
    pathname === DASHBOARD_ROUTES.orders ||
    pathname.startsWith(`${DASHBOARD_ROUTES.orders}/`)
  );
}

export function DashboardHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageMeta = getDashboardPageHeaderMeta(pathname);
  const inboxChrome = useOptionalInboxChrome();
  const contactsChrome = useOptionalContactsChrome();
  const aiAssistantChrome = useOptionalAiAssistantChrome();
  const calendarChrome = useOptionalCalendarChrome();
  const ordersChrome = useOptionalOrdersChrome();
  const showInboxToolbar = isInboxPath(pathname) && inboxChrome !== null;
  const showContactsToolbar =
    isContactsPath(pathname) && contactsChrome !== null;
  const showAiAssistantToolbar =
    isAiAssistantPath(pathname) && aiAssistantChrome !== null;
  const showCalendarToolbar =
    isCalendarPath(pathname) && calendarChrome !== null;
  const showOrdersToolbar = isOrdersPath(pathname) && ordersChrome !== null;
  const conversationOpen = Boolean(searchParams.get("conversation")?.trim());
  const contactOpen = Boolean(searchParams.get("contact")?.trim());
  const hideChromeOnMobileThread =
    (isInboxPath(pathname) && conversationOpen) ||
    (isContactsPath(pathname) && contactOpen);
  const showOnMobile = pathname === DASHBOARD_ROUTES.overview;

  return (
    <header
      className={cn(
        "glass-header shrink-0 items-center gap-2 px-3 sm:gap-3 sm:px-4",
        showOnMobile ? "flex h-14 min-h-14" : "hidden h-14 min-h-14 md:flex",
        hideChromeOnMobileThread && "max-md:hidden",
      )}
      data-dashboard-header={showOnMobile || undefined}
      data-mobile-header={showOnMobile ? "home" : "hidden"}
    >
      {showCalendarToolbar && calendarChrome ? (
        <CalendarToolbar chrome={calendarChrome} />
      ) : showContactsToolbar && contactsChrome ? (
        <div
          className={cn(
            "min-w-0 flex-1 items-center gap-2 sm:gap-3",
            hideChromeOnMobileThread ? "hidden lg:flex" : "flex",
          )}
        >
          <ContactsToolbar
            {...contactsChrome}
            className="min-w-0 justify-start sm:max-w-md md:max-w-lg"
          />
          <CrmEntityTabs
            activeTab={contactsChrome.activeTab}
            listData={contactsChrome.crmListData}
            dealsData={contactsChrome.crmDealsData}
            variant="header"
            className="shrink-0"
          />
        </div>
      ) : pageMeta ? (
        <>
          {!showInboxToolbar &&
          !showAiAssistantToolbar &&
          !showOrdersToolbar ? (
            <DashboardPageHeading
              title={pageMeta.title}
              className={cn(
                "min-w-0 truncate",
                hideChromeOnMobileThread && "hidden lg:block",
              )}
            />
          ) : null}

          {showInboxToolbar && inboxChrome ? (
            <div
              className={cn(
                "min-w-0 flex-1",
                hideChromeOnMobileThread && "hidden lg:block",
              )}
            >
              <InboxToolbar {...inboxChrome} className="justify-start" />
            </div>
          ) : showAiAssistantToolbar && aiAssistantChrome ? (
            <div className="min-w-0 flex-1">
              <AiAssistantToolbar
                {...aiAssistantChrome}
                className="justify-start"
              />
            </div>
          ) : showOrdersToolbar && ordersChrome ? (
            <div className="min-w-0 flex-1">
              <OrdersToolbar {...ordersChrome} className="justify-start" />
            </div>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
        </>
      ) : (
        <div className="flex-1" />
      )}
    </header>
  );
}
