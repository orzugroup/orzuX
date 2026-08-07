import { notFound, redirect } from "next/navigation";

import { DASHBOARD_ROUTES } from "@/constants/routes";
import { AI_ASSISTANT_MESSAGES } from "@/features/ai-assistant/constants";
import { Suspense } from "react";

import { IntegrationChannelShell } from "@/components/integrations/IntegrationChannelShell";
import { IntegrationSectionPanels } from "@/components/integrations/IntegrationSectionPanels";
import { getCurrentUser } from "@/services/auth.service";
import { getPrimaryBusiness } from "@/services/business.service";
import { getChannelContacts, getChannelAiSettings } from "@/services/channel-workspace.service";
import {
  getTelegramConnection,
  getTelegramConnectConfig,
} from "@/services/telegram.service";
import { getTelegramUserConnection } from "@/services/telegram-user.service";
import { getWhatsAppWebConnection } from "@/services/whatsapp-web.service";
import {
  getWebsiteFormConnection,
  getWebsiteFormConnectConfig,
} from "@/services/website-forms.service";
import {
  getWebsiteChatConnection,
  getWebsiteChatConnectConfig,
} from "@/services/website-chat.service";
import { getWebsiteKnowledgeSync } from "@/services/website-knowledge.service";
import {
  getInternetPhoneConnectConfig,
  getInternetPhoneConnection,
} from "@/services/internet-phone.service";
import {
  getVoiceAgentSettings,
  getVoiceConnectConfig,
  getVoiceConnection,
} from "@/services/voice-agent.service";
import {
  getTwilioNumberDiagnostics,
  listTwilioPhoneNumbersForBusiness,
} from "@/services/twilio-integration.service";
import { getActiveOrzuVoiceNumber } from "@/services/orzu-voice-numbers.service";
import {
  getGmailConnection,
  getGmailConnectConfig,
} from "@/services/gmail-integration.service";
import {
  getOutlookConnection,
  getOutlookConnectConfig,
} from "@/services/outlook-integration.service";
import {
  getGoogleCalendarConnection,
  getGoogleCalendarConnectConfig,
} from "@/services/google-calendar.service";
import {
  getWhatsAppConnection,
  getWhatsAppConnectConfig,
} from "@/services/whatsapp.service";
import {
  buildChannelWorkspaceHref,
  buildIntegrationChannelStatuses,
  DEFAULT_INTEGRATION_SECTION,
  INTEGRATIONS_MESSAGES,
  isChannelActivated,
  isIntegrationChannelId,
  isIntegrationSectionId,
  isLegacyIntegrationWorkspaceSection,
  isMessagingIntegrationChannel,
  type IntegrationChannelId,
  type IntegrationSectionId,
} from "@/features/integrations";

type IntegrationsChannelPageProps = {
  params: Promise<{ channel: string }>;
  searchParams: Promise<{ section?: string; from?: string }>;
};

export default async function IntegrationsChannelPage({
  params,
  searchParams,
}: IntegrationsChannelPageProps) {
  const { channel: channelParam } = await params;
  const { section: sectionParam, from: fromParam } = await searchParams;

  if (channelParam === "website_knowledge") {
    redirect(DASHBOARD_ROUTES.aiAssistantKnowledgeWebsite);
  }

  if (channelParam === "google-calendar") {
    redirect(`${DASHBOARD_ROUTES.integrations}/google_calendar?section=activate`);
  }

  if (channelParam === "telegram-personal") {
    redirect(`${DASHBOARD_ROUTES.integrations}/telegram_user?section=activate`);
  }

  if (!isIntegrationChannelId(channelParam)) {
    notFound();
  }

  const channel: IntegrationChannelId = channelParam;

  if (isLegacyIntegrationWorkspaceSection(sectionParam)) {
    redirect(buildChannelWorkspaceHref(channel, sectionParam));
  }

  const section: IntegrationSectionId = isIntegrationSectionId(sectionParam)
    ? sectionParam
    : DEFAULT_INTEGRATION_SECTION;

  const user = await getCurrentUser();
  const business = user ? await getPrimaryBusiness(user.id) : null;

  const [
    whatsappConnection,
    whatsappConnectConfig,
    whatsappWebConnection,
    telegramConnection,
    telegramConfig,
    telegramUserConnection,
    websiteFormConnection,
    websiteFormConfig,
    websiteChatConnection,
    websiteChatConfig,
    websiteKnowledgeSync,
    voiceConnection,
    voiceSettings,
    voiceConnectConfig,
    twilioPhoneNumbers,
    twilioDiagnostics,
    orzuVoiceNumber,
    internetPhoneConnection,
    internetPhoneConfig,
    googleCalendarConnection,
    googleCalendarConnectConfig,
    gmailConnection,
    gmailConnectConfig,
    outlookConnection,
    outlookConnectConfig,
  ] = await Promise.all([
    business ? getWhatsAppConnection(business.id) : Promise.resolve(null),
    Promise.resolve(getWhatsAppConnectConfig()),
    business ? getWhatsAppWebConnection(business.id) : Promise.resolve(null),
    business ? getTelegramConnection(business.id) : Promise.resolve(null),
    Promise.resolve(getTelegramConnectConfig()),
    business ? getTelegramUserConnection(business.id) : Promise.resolve(null),
    business ? getWebsiteFormConnection(business.id) : Promise.resolve(null),
    Promise.resolve(getWebsiteFormConnectConfig()),
    business ? getWebsiteChatConnection(business.id) : Promise.resolve(null),
    Promise.resolve(getWebsiteChatConnectConfig()),
    business ? getWebsiteKnowledgeSync(business.id) : Promise.resolve(null),
    business ? getVoiceConnection(business.id) : Promise.resolve(null),
    business ? getVoiceAgentSettings(business.id) : Promise.resolve(null),
    Promise.resolve(getVoiceConnectConfig()),
    business
      ? listTwilioPhoneNumbersForBusiness(business.id)
      : Promise.resolve([]),
    business && channel === "voice"
      ? getTwilioNumberDiagnostics(business.id)
      : Promise.resolve(null),
    business && channel === "voice"
      ? getActiveOrzuVoiceNumber(business.id)
      : Promise.resolve(null),
    business ? getInternetPhoneConnection(business.id) : Promise.resolve(null),
    Promise.resolve(getInternetPhoneConnectConfig()),
    business ? getGoogleCalendarConnection(business.id) : Promise.resolve(null),
    Promise.resolve(getGoogleCalendarConnectConfig()),
    business ? getGmailConnection(business.id) : Promise.resolve(null),
    Promise.resolve(getGmailConnectConfig()),
    business ? getOutlookConnection(business.id) : Promise.resolve(null),
    Promise.resolve(getOutlookConnectConfig()),
  ]);

  const channelStatuses = buildIntegrationChannelStatuses({
    whatsappConnection,
    whatsappWebConnection,
    telegramConnection,
    telegramUserConnection,
    websiteFormConnection,
    websiteChatConnection,
    websiteKnowledgeSync,
    voiceConnection,
    voiceSmsEnabled: voiceSettings?.smsEnabled ?? false,
    internetPhoneConnection,
    googleCalendarConnection,
    gmailConnection,
    outlookConnection,
  });

  const isActivated = isChannelActivated(channel, channelStatuses);
  const fromAiAssistant = fromParam === "ai-assistant";
  const backHref = fromAiAssistant
    ? DASHBOARD_ROUTES.aiAssistantChannels
    : isActivated
      ? DASHBOARD_ROUTES.integrations
      : DASHBOARD_ROUTES.marketplace;
  const backLabel = fromAiAssistant
    ? AI_ASSISTANT_MESSAGES.wizardBackToChannels
    : isActivated
      ? INTEGRATIONS_MESSAGES.backToIntegrations
      : INTEGRATIONS_MESSAGES.backToMarketplace;
  const channelContacts =
    business && isMessagingIntegrationChannel(channel)
      ? await getChannelContacts(channel)
      : null;
  const channelAiSettings =
    business && isMessagingIntegrationChannel(channel) && isActivated
      ? await getChannelAiSettings(channel)
      : null;

  return (
    <Suspense fallback={<IntegrationChannelFallback channel={channel} />}>
      <IntegrationChannelShell
        activeChannel={channel}
        channelStatuses={channelStatuses}
        isActivated={isActivated}
        backHref={backHref}
        backLabel={backLabel}
      >
        <IntegrationSectionPanels
          channel={channel}
          section={section}
          hasBusiness={Boolean(business)}
          channelStatuses={channelStatuses}
          whatsapp={{
            connection: whatsappConnection,
            connectConfig: whatsappConnectConfig,
          }}
          whatsappWeb={{
            connection: whatsappWebConnection,
            businessId: business?.id ?? null,
          }}
          telegram={{
            connection: telegramConnection,
            connectConfig: telegramConfig,
          }}
          telegramUser={{
            connection: telegramUserConnection,
          }}
          websiteForms={{
            connection: websiteFormConnection,
            connectConfig: websiteFormConfig,
          }}
          websiteChat={{
            connection: websiteChatConnection,
            connectConfig: websiteChatConfig,
          }}
          voice={
            voiceConnection && voiceSettings
              ? {
                  connection: voiceConnection,
                  settings: voiceSettings,
                  connectConfig: voiceConnectConfig,
                  availablePhoneNumbers: twilioPhoneNumbers,
                  diagnostics: twilioDiagnostics,
                  forwardToE164: orzuVoiceNumber?.forwardToE164 ?? null,
                }
              : undefined
          }
          sms={{
            connection: voiceConnection,
            settings: voiceSettings,
          }}
          internetPhone={{
            connection: internetPhoneConnection,
            connectConfig: internetPhoneConfig,
            businessId: business?.id ?? null,
          }}
          googleCalendar={{
            connection: googleCalendarConnection,
            connectConfig: googleCalendarConnectConfig,
          }}
          gmail={{
            connection: gmailConnection,
            connectConfig: gmailConnectConfig,
          }}
          outlook={{
            connection: outlookConnection,
            connectConfig: outlookConnectConfig,
          }}
          channelContacts={channelContacts}
          channelAiSettings={channelAiSettings}
        />
      </IntegrationChannelShell>
    </Suspense>
  );
}

function IntegrationChannelFallback({
  channel,
}: {
  channel: IntegrationChannelId;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="min-h-[32rem] animate-pulse bg-muted/30" />
      <span className="sr-only">Loading {channel} integration</span>
    </div>
  );
}
