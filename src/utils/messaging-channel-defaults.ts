import type { MessagingChannel } from "@/types/database.types";

export function createEmptyUnreadByChannel(): Record<MessagingChannel, number> {
  return {
    whatsapp: 0,
    whatsapp_web: 0,
    telegram: 0,
    telegram_user: 0,
    instagram: 0,
    website_forms: 0,
    website_chat: 0,
    email: 0,
    outlook: 0,
    facebook_messenger: 0,
    voice: 0,
    sms: 0,
    internet_phone: 0,
  };
}

export function createEmptyChannelConnectionMap(): Record<MessagingChannel, boolean> {
  return {
    whatsapp: false,
    whatsapp_web: false,
    telegram: false,
    telegram_user: false,
    instagram: false,
    website_forms: false,
    website_chat: false,
    email: false,
    outlook: false,
    facebook_messenger: false,
    voice: false,
    sms: false,
    internet_phone: false,
  };
}
