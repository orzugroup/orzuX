import type { ComponentType, SVGProps } from "react";

import {
  GmailIcon,
  GoogleCalendarIcon,
  MessengerIcon,
  OutlookIcon,
  SmsIcon,
  TelegramIcon,
  VoiceIcon,
  WebsiteChatIcon,
  WebsiteFormsIcon,
  WhatsAppBusinessIcon,
  WhatsAppIcon,
} from "@/components/icons/channel-brand-icons";
import { DASHBOARD_ROUTES } from "@/constants/routes";
import type { MessagingChannel } from "@/types/database.types";
import type { MarketplaceCategoryId } from "./marketplace-categories";

export type ChannelIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const MESSAGING_INTEGRATION_CHANNELS = [
  "whatsapp",
  "whatsapp_web",
  "telegram",
  "telegram_user",
  "website_forms",
  "website_chat",
  "email",
  "outlook",
] as const;

/** Channels shown in Chats inbox (website forms go to Orders, not Chats). */
export const INBOX_MESSAGING_CHANNELS = [
  "whatsapp",
  "whatsapp_web",
  "telegram",
  "telegram_user",
  "website_chat",
  "email",
  "outlook",
] as const;

/** All channels the AI Agent can be enabled on (messaging + SMS + voice calls). */
export const AI_AGENT_CHANNELS = [
  ...MESSAGING_INTEGRATION_CHANNELS,
  "sms",
  "voice",
] as const;

export const INTEGRATION_CHANNELS = [
  ...MESSAGING_INTEGRATION_CHANNELS,
  "facebook_messenger",
  "sms",
  "voice",
  "internet_phone",
  "google_calendar",
  "website_knowledge",
] as const;

export type MessagingIntegrationChannelId =
  (typeof MESSAGING_INTEGRATION_CHANNELS)[number];

export type InboxMessagingChannelId =
  (typeof INBOX_MESSAGING_CHANNELS)[number];

export type AiAgentChannelId = (typeof AI_AGENT_CHANNELS)[number];

export type IntegrationChannelId = (typeof INTEGRATION_CHANNELS)[number];

export function isMessagingIntegrationChannel(
  channel: IntegrationChannelId,
): channel is MessagingIntegrationChannelId {
  return (MESSAGING_INTEGRATION_CHANNELS as readonly string[]).includes(channel);
}

export function isAiAgentChannel(
  channel: string,
): channel is AiAgentChannelId {
  return (AI_AGENT_CHANNELS as readonly string[]).includes(channel);
}

export function isInboxMessagingChannel(
  channel: MessagingChannel,
): channel is InboxMessagingChannelId {
  return (INBOX_MESSAGING_CHANNELS as readonly string[]).includes(channel);
}

export const INTEGRATION_SECTIONS = ["activate", "contacts"] as const;

export const INTEGRATION_WIZARD_STEPS = [
  { id: "connect", label: "Connect" },
  { id: "configure-ai", label: "AI Assistant" },
  { id: "test", label: "Test" },
  { id: "go-live", label: "Go live" },
] as const;

export type IntegrationWizardStepId =
  (typeof INTEGRATION_WIZARD_STEPS)[number]["id"];

export const LEGACY_INTEGRATION_WORKSPACE_SECTIONS = [
  "ai-assistant",
  "analytics",
] as const;

export type LegacyIntegrationWorkspaceSectionId =
  (typeof LEGACY_INTEGRATION_WORKSPACE_SECTIONS)[number];

export type IntegrationSectionId = (typeof INTEGRATION_SECTIONS)[number];

export const DEFAULT_INTEGRATION_CHANNEL: IntegrationChannelId = "whatsapp";
export const DEFAULT_INTEGRATION_SECTION: IntegrationSectionId = "activate";

export type IntegrationChannelConfig = {
  id: IntegrationChannelId;
  label: string;
  category: string;
  marketplaceCategory: MarketplaceCategoryId;
  description: string;
  icon: ChannelIconComponent;
  available: boolean;
};

export const INTEGRATION_CHANNEL_LIST: IntegrationChannelConfig[] = [
  {
    id: "whatsapp",
    label: "WhatsApp Business",
    category: "WhatsApp",
    marketplaceCategory: "messengers",
    description: "Official WhatsApp Business Cloud API (Meta / 360dialog)",
    icon: WhatsAppBusinessIcon,
    available: true,
  },
  {
    id: "whatsapp_web",
    label: "WhatsApp",
    category: "WhatsApp",
    marketplaceCategory: "messengers",
    description: "Personal WhatsApp via QR code (WhatsApp Web)",
    icon: WhatsAppIcon,
    available: true,
  },
  {
    id: "telegram",
    label: "Telegram Bot",
    category: "Telegram",
    marketplaceCategory: "messengers",
    description: "Telegram Bot API for customer conversations",
    icon: TelegramIcon,
    available: true,
  },
  {
    id: "telegram_user",
    label: "Telegram",
    category: "Telegram",
    marketplaceCategory: "messengers",
    description: "Personal Telegram account via phone login (MTProto)",
    icon: TelegramIcon,
    available: true,
  },
  {
    id: "facebook_messenger",
    label: "Messenger",
    category: "Messenger",
    marketplaceCategory: "messengers",
    description: "Facebook Messenger for your business page",
    icon: MessengerIcon,
    available: false,
  },
  {
    id: "website_chat",
    label: "Website Chat",
    category: "Website",
    marketplaceCategory: "website",
    description: "Embed live chat on your site — messages sync to Inbox",
    icon: WebsiteChatIcon,
    available: true,
  },
  {
    id: "website_forms",
    label: "Lead Forms",
    category: "Website",
    marketplaceCategory: "website",
    description: "Capture leads from any website or CMS via webhook",
    icon: WebsiteFormsIcon,
    available: true,
  },
  {
    id: "email",
    label: "Gmail",
    category: "Email",
    marketplaceCategory: "email",
    description: "Gmail inbox and AI replies",
    icon: GmailIcon,
    available: true,
  },
  {
    id: "outlook",
    label: "Outlook",
    category: "Email",
    marketplaceCategory: "email",
    description: "Microsoft Outlook / Microsoft 365 inbox and AI replies",
    icon: OutlookIcon,
    available: true,
  },
  {
    id: "sms",
    label: "SMS",
    category: "SMS",
    marketplaceCategory: "sms",
    description: "Two-way SMS via Twilio",
    icon: SmsIcon,
    available: true,
  },
  {
    id: "voice",
    label: "Calls",
    category: "Calls",
    marketplaceCategory: "calls",
    description: "AI phone line, inbound and outbound calls via Twilio",
    icon: VoiceIcon,
    available: true,
  },
  {
    id: "internet_phone",
    label: "Internet Phone",
    category: "Calls",
    marketplaceCategory: "calls",
    description:
      "Browser WebRTC phone with public link, QR code, and printable PDF",
    icon: VoiceIcon,
    available: true,
  },
  {
    id: "google_calendar",
    label: "Google Calendar",
    category: "Productivity",
    marketplaceCategory: "other",
    description: "AI booking and calendar sync",
    icon: GoogleCalendarIcon,
    available: true,
  },
];

export const INTEGRATION_SECTION_LIST: Array<{
  id: IntegrationSectionId;
  label: string;
  href: (channel: IntegrationChannelId) => string;
}> = [
  {
    id: "activate",
    label: "Activate",
    href: (channel) =>
      `${DASHBOARD_ROUTES.integrations}/${channel}?section=activate`,
  },
  {
    id: "contacts",
    label: "Contacts",
    href: (channel) =>
      `${DASHBOARD_ROUTES.integrations}/${channel}?section=contacts`,
  },
];

export const INTEGRATIONS_MESSAGES = {
  pageTitle: "Integrations",
  pageDescription:
    "Connect messaging channels and manage activation and contacts per product.",
  indexDescription:
    "Your connected channels. Add more from the Marketplace.",
  indexEmptyTitle: "No active integrations yet",
  indexEmptyDescription:
    "Browse the Marketplace to connect WhatsApp, Website Chat, Calls, SMS, and more.",
  marketplaceTitle: "Integrations Marketplace",
  marketplaceDescription:
    "Connect channels by category. Activated integrations show a green badge in My integrations.",
  marketplaceAiTitle: "AI Agent",
  marketplaceAiDescription:
    "Configure replies, tools, follow-ups, and orchestration for all channels.",
  backToIntegrations: "My integrations",
  backToMarketplace: "Marketplace",
  configureChannel: "Open settings",
  connectChannel: "Connect",
  sectionSettings: "Settings",
  channelsTitle: "Channels",
  selectChannel: "Select a channel to configure.",
  comingSoonTitle: "Coming in Version 2",
  comingSoonDescription:
    "This channel is prepared in the integrations hub. API connection will be enabled in the next release phase.",
  sectionActivate: "Activate",
  sectionContacts: "Contacts",
  sectionAiAssistant: "AI",
  sectionAnalytics: "Analytics",
  contactsHint: "Contacts received on this channel.",
  aiPreviewTitle: "AI auto-reply",
  aiPreviewDescription:
    "Turn on the AI Assistant for this channel. Replies use your AI Assistant profile (Gemini first, with OpenAI or Claude fallback).",
  aiPreviewEnabled: "AI Assistant is on for this channel.",
  aiPreviewDisabled: "AI Assistant is off for this channel.",
  openAiSettings: "Open AI Assistant",
  analyticsHint: "Messages, contacts, and AI metrics for this channel.",
  openGlobalContacts: "Open Contacts",
  openGlobalAi: "Open AI",
  openGlobalAnalytics: "Open Analytics",
  activateFirstTitle: "Connect this channel first",
  activateFirstDescription:
    "Open Activate and complete the connection before using Contacts or AI for this channel.",
  goToActivate: "Go to Activate",
  dangerZoneTitle: "Disconnect channel",
  dangerZoneDescription:
    "Stop receiving messages and remove this connection from OrzuX. All conversations and messages for this channel are permanently deleted from OrzuX. Your external account (e.g. Gmail, Meta, Telegram) and its data are not affected. Contacts and CRM records are kept.",
  disconnectStep1Button: "Disconnect…",
  disconnectStep2Title: "Confirm disconnect",
  disconnectStep2Description: (resource: string) =>
    `This permanently deletes all ${resource} conversations and messages from OrzuX and removes the connection. Contacts and CRM data are kept, and your external account is untouched. This cannot be undone — you can reconnect anytime.`,
  disconnectConfirmButton: "Yes, disconnect",
  disconnectCancelButton: "Cancel",
  disconnecting: "Disconnecting…",
  disconnectError: "Could not disconnect. Please try again.",
  connectedQuickLinks: "Workspace",
  statusConnected: "Connected",
  statusActivated: "Activated",
  statusPending: "Pending",
  statusDisconnected: "Not connected",
  statusComingSoon: "Coming soon",
  channelContextPrefix: "Viewing workspace for",
  webhookReceiving: "Receiving messages",
  webhookWaiting: "Waiting for first message",
  webhookDisconnected: "Not connected",
  wizardTitle: "Setup flow",
  wizardDescription:
    "Connect your channel, enable AI Assistant, test a reply, then open the inbox.",
} as const;

export function buildIntegrationAiSettingsHref(
  _channel: MessagingIntegrationChannelId,
): string {
  return DASHBOARD_ROUTES.aiAssistant;
}

export function buildChannelWorkspaceHref(
  channel: IntegrationChannelId,
  workspace: "contacts" | "ai-assistant" | "analytics",
): string {
  const base =
    workspace === "contacts"
      ? DASHBOARD_ROUTES.contacts
      : workspace === "ai-assistant"
        ? DASHBOARD_ROUTES.aiAssistant
        : DASHBOARD_ROUTES.analytics;

  if (workspace === "ai-assistant" && isMessagingIntegrationChannel(channel)) {
    return buildIntegrationAiSettingsHref(channel);
  }

  return `${base}?channel=${channel}`;
}

export function buildIntegrationActivateHref(
  channel: IntegrationChannelId,
  options?: { from?: "ai-assistant" },
): string {
  const params = new URLSearchParams({ section: "activate" });
  if (options?.from === "ai-assistant") {
    params.set("from", "ai-assistant");
  }
  return `${DASHBOARD_ROUTES.integrations}/${channel}?${params.toString()}`;
}

export function isIntegrationChannelId(
  value: string,
): value is IntegrationChannelId {
  return INTEGRATION_CHANNELS.includes(value as IntegrationChannelId);
}

export function isIntegrationSectionId(
  value: string | null | undefined,
): value is IntegrationSectionId {
  return (
    value !== null &&
    value !== undefined &&
    INTEGRATION_SECTIONS.includes(value as IntegrationSectionId)
  );
}

export function isLegacyIntegrationWorkspaceSection(
  value: string | null | undefined,
): value is LegacyIntegrationWorkspaceSectionId {
  return (
    value !== null &&
    value !== undefined &&
    LEGACY_INTEGRATION_WORKSPACE_SECTIONS.includes(
      value as LegacyIntegrationWorkspaceSectionId,
    )
  );
}
