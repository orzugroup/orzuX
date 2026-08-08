export const APP_ROUTES = {
  home: "/",
  dashboard: "/dashboard",
} as const;

export const LEGAL_ROUTES = {
  privacy: "/privacy",
  terms: "/terms",
  dataDeletion: "/data-deletion",
} as const;

export const DOCS_ROUTES = {
  root: "/docs",
  about: "/docs/about",
  gettingStarted: "/docs/getting-started",
  page: (slug: string) => `/docs/${slug}`,
} as const;

export const AUTH_ROUTES = {
  callback: "/auth/callback",
  confirm: "/auth/confirm",
  google: "/auth/google",
  authCodeError: "/auth/auth-code-error",
  login: "/auth/login",
  logout: "/auth/logout",
  register: "/auth/register",
  registerConfirmation: "/auth/register/confirmation",
  verifySuccess: "/auth/verify/success",
  forgotPassword: "/auth/forgot-password",
  forgotPasswordConfirmation: "/auth/forgot-password/confirmation",
  magicLinkConfirmation: "/auth/magic-link/confirmation",
  resetPassword: "/auth/reset-password",
  resetPasswordSuccess: "/auth/reset-password/success",
  teamInviteAccept: "/auth/team-invite",
} as const;

export const DASHBOARD_ROUTES = {
  overview: "/dashboard",
  onboarding: "/dashboard/onboarding",
  suspended: "/dashboard/suspended",
  chats: "/dashboard/chats",
  chatsMonitor: "/dashboard/chats",
  chatsFavorites: "/dashboard/chats/favorites",
  /** @deprecated Use `voice` — kept as alias for existing links. */
  chatsVoice: "/dashboard/voice",
  /** @deprecated Use `voiceMonitor`. */
  chatsVoiceMonitor: "/dashboard/voice/monitor",
  voice: "/dashboard/voice",
  voiceMonitor: "/dashboard/voice/monitor",
  chatsSms: "/dashboard/chats/sms",
  orders: "/dashboard/orders",
  contacts: "/dashboard/contacts",
  knowledgeBase: "/dashboard/knowledge-base",
  integrations: "/dashboard/integrations",
  aiAssistant: "/dashboard/ai-assistant",
  aiAssistantChannels: "/dashboard/ai-assistant/channels",
  aiAssistantChannelSettings: (channel: string) =>
    `/dashboard/ai-assistant/channels/${channel}/settings`,
  aiAssistantKnowledge: "/dashboard/ai-assistant/knowledge",
  aiAssistantKnowledgeImport: "/dashboard/ai-assistant/knowledge/import",
  aiAssistantKnowledgeWebsite: "/dashboard/ai-assistant/knowledge/website",
  aiAssistantKnowledgeGenerate: "/dashboard/ai-assistant/knowledge/generate",
  aiAssistantKnowledgeCategory: (slug: string) =>
    `/dashboard/ai-assistant/knowledge/c/${encodeURIComponent(slug)}`,
  aiAssistantVoice: "/dashboard/ai-assistant/voice",
  aiAssistantSettings: "/dashboard/ai-assistant/settings",
  aiAssistantSection: "/dashboard/ai-assistant",
  aiAgentsSection: "/dashboard/ai-assistant",
  aiManager: "/dashboard/ai-assistant",
  analytics: "/dashboard/analytics",
  settings: "/dashboard/settings",
  account: "/dashboard/account",
  profile: "/dashboard/profile",
  subscription: "/dashboard/subscription",
  subscriptionUsage: "/dashboard/subscription/usage",
  subscriptionInvoices: "/dashboard/subscription/invoices",
  subscriptionPayments: "/dashboard/subscription/payments",
  subscriptionWhatsApp: "/dashboard/subscription/whatsapp",
  subscriptionTwilio: "/dashboard/subscription/twilio",
  settingsPush: "/dashboard/settings/push",
  settingsQuickReplies: "/dashboard/settings/quick-replies",
  settingsLanguage: "/dashboard/settings/language",
  marketplace: "/dashboard/integrations/marketplace",
  calendar: "/dashboard/calendar",
  team: "/dashboard/team",
  teamOnboarding: "/dashboard/team-onboarding",
  calendarBooking: "/dashboard/calendar/booking",
  calendarBookingNew: "/dashboard/calendar/booking/new",
  googleCalendarIntegration: "/dashboard/integrations/google_calendar",
} as const;

export const PUBLIC_ROUTES = {
  book: (slug: string) => `/book/${slug}`,
  call: (publicId: string) => `/call/${publicId}`,
} as const;

export const PROTECTED_ROUTE_PREFIXES = ["/dashboard"] as const;
