export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AuthProvider = "google" | "email";

export type KnowledgeCategory = string;

export type WhatsappStatus = "connected" | "disconnected" | "pending";

export type InstagramStatus = "connected" | "disconnected" | "pending";

export type TelegramStatus = "connected" | "disconnected" | "pending";

export type TelegramUserStatus =
  | "disconnected"
  | "pending_code"
  | "pending_password"
  | "connected";

export type WhatsAppWebStatus = "disconnected" | "pending_qr" | "connected";

export type EmailConnectionStatus = "connected" | "disconnected" | "pending";

export type GoogleCalendarStatus = "connected" | "disconnected" | "pending";
export type TwilioConnectionStatus =
  | "connected"
  | "disconnected"
  | "authorized";

export type TwilioBillingOwner = "customer" | "platform";

export type TwilioAuthMode = "platform" | "connect" | "api_key" | "auth_token";

export type OrzuVoiceNumberStatus =
  | "provisioning"
  | "active"
  | "releasing"
  | "released";

export type WebsiteFormStatus = "connected" | "disconnected" | "pending";

export type WebsiteFormFollowUp =
  | "whatsapp"
  | "telegram"
  | "email"
  | "none";

export type WebsiteKnowledgeSyncStatus = "idle" | "syncing" | "ready" | "error";

export type MessagingChannel =
  | "whatsapp"
  | "whatsapp_web"
  | "instagram"
  | "telegram"
  | "telegram_user"
  | "website_forms"
  | "facebook_messenger"
  | "email"
  | "outlook"
  | "voice"
  | "sms"
  | "website_chat"
  | "internet_phone";

export type ConversationStatus =
  | "open"
  | "pending"
  | "resolved"
  | "snoozed"
  | "active"
  | "archived"
  | "closed";

export type MessageSenderType = "user" | "client" | "ai";
export type MessageDeliveryStatus =
  | "pending"
  | "processing"
  | "sent"
  | "delivered"
  | "read"
  | "failed";
export type MessageAttachmentKind = "image" | "audio" | "video" | "document";
export type MessageAttachmentStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed";
export type WebhookQueueStatus = "pending" | "processing" | "completed" | "failed";

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          auth_provider: AuthProvider;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          auth_provider?: AuthProvider;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          auth_provider?: AuthProvider;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          business_description: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          website: string | null;
          logo_url: string | null;
          subscription_plan: string;
          subscription_status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_addons: Json;
          trial_ends_at: string | null;
          trial_ended_email_sent_at: string | null;
          twilio_wallet_balance_cents: number;
          prefer_customer_ai_keys: boolean;
          order_form_fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_name: string;
          business_description?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          website?: string | null;
          logo_url?: string | null;
          subscription_plan?: string;
          subscription_status?: string;
          trial_ends_at?: string | null;
          trial_ended_email_sent_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_addons?: Json;
          twilio_wallet_balance_cents?: number;
          prefer_customer_ai_keys?: boolean;
          order_form_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          business_name?: string;
          business_description?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          website?: string | null;
          logo_url?: string | null;
          subscription_plan?: string;
          subscription_status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_addons?: Json;
          trial_ends_at?: string | null;
          trial_ended_email_sent_at?: string | null;
          twilio_wallet_balance_cents?: number;
          prefer_customer_ai_keys?: boolean;
          order_form_fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "businesses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      website_knowledge_syncs: {
        Row: {
          id: string;
          business_id: string;
          site_url: string;
          sync_status: WebsiteKnowledgeSyncStatus;
          auto_sync_enabled: boolean;
          sync_interval_hours: number;
          last_synced_at: string | null;
          next_sync_at: string | null;
          last_sync_error: string | null;
          pages_indexed: number;
          entries_synced: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          site_url: string;
          sync_status?: WebsiteKnowledgeSyncStatus;
          auto_sync_enabled?: boolean;
          sync_interval_hours?: number;
          last_synced_at?: string | null;
          next_sync_at?: string | null;
          last_sync_error?: string | null;
          pages_indexed?: number;
          entries_synced?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          site_url?: string;
          sync_status?: WebsiteKnowledgeSyncStatus;
          auto_sync_enabled?: boolean;
          sync_interval_hours?: number;
          last_synced_at?: string | null;
          next_sync_at?: string | null;
          last_sync_error?: string | null;
          pages_indexed?: number;
          entries_synced?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "website_knowledge_syncs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_base: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          content: string;
          category: KnowledgeCategory;
          source: string;
          source_url: string | null;
          metadata: Record<string, unknown>;
          embedding: string | null;
          embedding_model: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          title: string;
          content: string;
          category: KnowledgeCategory;
          source?: string;
          source_url?: string | null;
          metadata?: Record<string, unknown>;
          embedding?: string | null;
          embedding_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          title?: string;
          content?: string;
          category?: KnowledgeCategory;
          source?: string;
          source_url?: string | null;
          metadata?: Record<string, unknown>;
          embedding?: string | null;
          embedding_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_base_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_categories: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          slug: string;
          description: string;
          layout_kind: string;
          is_system: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          slug: string;
          description?: string;
          layout_kind?: string;
          is_system?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          slug?: string;
          description?: string;
          layout_kind?: string;
          is_system?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_categories_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_connections: {
        Row: {
          id: string;
          business_id: string;
          phone_number: string;
          whatsapp_status: WhatsappStatus;
          connected_at: string | null;
          created_at: string;
          meta_phone_number_id: string | null;
          meta_access_token: string | null;
          meta_access_token_secret_key_name: string | null;
          meta_waba_id: string | null;
          meta_business_account_id: string | null;
          dialog360_channel_id: string | null;
          dialog360_client_id: string | null;
          verification_code_hash: string | null;
          verification_expires_at: string | null;
          last_synced_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          phone_number: string;
          whatsapp_status?: WhatsappStatus;
          connected_at?: string | null;
          created_at?: string;
          meta_phone_number_id?: string | null;
          meta_access_token?: string | null;
          meta_access_token_secret_key_name?: string | null;
          meta_waba_id?: string | null;
          meta_business_account_id?: string | null;
          dialog360_channel_id?: string | null;
          dialog360_client_id?: string | null;
          verification_code_hash?: string | null;
          verification_expires_at?: string | null;
          last_synced_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          phone_number?: string;
          whatsapp_status?: WhatsappStatus;
          connected_at?: string | null;
          created_at?: string;
          meta_phone_number_id?: string | null;
          meta_access_token?: string | null;
          meta_access_token_secret_key_name?: string | null;
          meta_waba_id?: string | null;
          meta_business_account_id?: string | null;
          dialog360_channel_id?: string | null;
          dialog360_client_id?: string | null;
          verification_code_hash?: string | null;
          verification_expires_at?: string | null;
          last_synced_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      instagram_connections: {
        Row: {
          id: string;
          business_id: string;
          instagram_username: string;
          instagram_status: InstagramStatus;
          meta_page_id: string | null;
          meta_ig_user_id: string | null;
          meta_access_token: string | null;
          meta_access_token_secret_key_name: string | null;
          meta_business_account_id: string | null;
          connected_at: string | null;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          instagram_username?: string;
          instagram_status?: InstagramStatus;
          meta_page_id?: string | null;
          meta_ig_user_id?: string | null;
          meta_access_token?: string | null;
          meta_access_token_secret_key_name?: string | null;
          meta_business_account_id?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          instagram_username?: string;
          instagram_status?: InstagramStatus;
          meta_page_id?: string | null;
          meta_ig_user_id?: string | null;
          meta_access_token?: string | null;
          meta_access_token_secret_key_name?: string | null;
          meta_business_account_id?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "instagram_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      telegram_connections: {
        Row: {
          id: string;
          business_id: string;
          bot_username: string;
          telegram_status: TelegramStatus;
          telegram_bot_id: string | null;
          bot_token: string | null;
          bot_token_secret_key_name: string | null;
          webhook_secret: string | null;
          webhook_secret_secret_key_name: string | null;
          webhook_secret_hash: string | null;
          connected_at: string | null;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          bot_username?: string;
          telegram_status?: TelegramStatus;
          telegram_bot_id?: string | null;
          bot_token?: string | null;
          bot_token_secret_key_name?: string | null;
          webhook_secret?: string | null;
          webhook_secret_secret_key_name?: string | null;
          webhook_secret_hash?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          bot_username?: string;
          telegram_status?: TelegramStatus;
          telegram_bot_id?: string | null;
          bot_token?: string | null;
          bot_token_secret_key_name?: string | null;
          webhook_secret?: string | null;
          webhook_secret_secret_key_name?: string | null;
          webhook_secret_hash?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "telegram_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      telegram_user_connections: {
        Row: {
          id: string;
          business_id: string;
          status: TelegramUserStatus;
          phone_number: string | null;
          phone_code_hash: string | null;
          telegram_user_id: string | null;
          username: string | null;
          first_name: string | null;
          session_secret_key_name: string | null;
          connected_at: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          status?: TelegramUserStatus;
          phone_number?: string | null;
          phone_code_hash?: string | null;
          telegram_user_id?: string | null;
          username?: string | null;
          first_name?: string | null;
          session_secret_key_name?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          status?: TelegramUserStatus;
          phone_number?: string | null;
          phone_code_hash?: string | null;
          telegram_user_id?: string | null;
          username?: string | null;
          first_name?: string | null;
          session_secret_key_name?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "telegram_user_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_field_icons: {
        Row: {
          key: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          key: string;
          label: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          key?: string;
          label?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      whatsapp_web_connections: {
        Row: {
          id: string;
          business_id: string;
          status: WhatsAppWebStatus;
          phone_number: string | null;
          qr_code: string | null;
          qr_expires_at: string | null;
          creds_secret_key_name: string | null;
          connected_at: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          status?: WhatsAppWebStatus;
          phone_number?: string | null;
          qr_code?: string | null;
          qr_expires_at?: string | null;
          creds_secret_key_name?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          status?: WhatsAppWebStatus;
          phone_number?: string | null;
          qr_code?: string | null;
          qr_expires_at?: string | null;
          creds_secret_key_name?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_web_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      email_connections: {
        Row: {
          id: string;
          business_id: string;
          email_status: EmailConnectionStatus;
          gmail_address: string | null;
          access_token: string | null;
          access_token_secret_key_name: string | null;
          refresh_token: string | null;
          refresh_token_secret_key_name: string | null;
          token_expires_at: string | null;
          history_id: string | null;
          last_synced_at: string | null;
          watch_expiration: string | null;
          connected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          email_status?: EmailConnectionStatus;
          gmail_address?: string | null;
          access_token?: string | null;
          access_token_secret_key_name?: string | null;
          refresh_token?: string | null;
          refresh_token_secret_key_name?: string | null;
          token_expires_at?: string | null;
          history_id?: string | null;
          last_synced_at?: string | null;
          watch_expiration?: string | null;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          email_status?: EmailConnectionStatus;
          gmail_address?: string | null;
          access_token?: string | null;
          access_token_secret_key_name?: string | null;
          refresh_token?: string | null;
          refresh_token_secret_key_name?: string | null;
          token_expires_at?: string | null;
          history_id?: string | null;
          last_synced_at?: string | null;
          watch_expiration?: string | null;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      outlook_connections: {
        Row: {
          id: string;
          business_id: string;
          status: EmailConnectionStatus;
          outlook_address: string | null;
          access_token_secret_key_name: string | null;
          refresh_token_secret_key_name: string | null;
          token_expires_at: string | null;
          delta_link: string | null;
          last_synced_at: string | null;
          connected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          status?: EmailConnectionStatus;
          outlook_address?: string | null;
          access_token_secret_key_name?: string | null;
          refresh_token_secret_key_name?: string | null;
          token_expires_at?: string | null;
          delta_link?: string | null;
          last_synced_at?: string | null;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          status?: EmailConnectionStatus;
          outlook_address?: string | null;
          access_token_secret_key_name?: string | null;
          refresh_token_secret_key_name?: string | null;
          token_expires_at?: string | null;
          delta_link?: string | null;
          last_synced_at?: string | null;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outlook_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_invoices: {
        Row: {
          id: string;
          business_id: string;
          stripe_customer_id: string | null;
          number: string | null;
          status: string;
          amount_due_cents: number;
          amount_paid_cents: number;
          currency: string;
          line_items: Json;
          period_start: string | null;
          period_end: string | null;
          hosted_invoice_url: string | null;
          pdf_url: string | null;
          created_at: string;
          synced_at: string;
        };
        Insert: {
          id: string;
          business_id: string;
          stripe_customer_id?: string | null;
          number?: string | null;
          status: string;
          amount_due_cents?: number;
          amount_paid_cents?: number;
          currency?: string;
          line_items?: Json;
          period_start?: string | null;
          period_end?: string | null;
          hosted_invoice_url?: string | null;
          pdf_url?: string | null;
          created_at: string;
          synced_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          stripe_customer_id?: string | null;
          number?: string | null;
          status?: string;
          amount_due_cents?: number;
          amount_paid_cents?: number;
          currency?: string;
          line_items?: Json;
          period_start?: string | null;
          period_end?: string | null;
          hosted_invoice_url?: string | null;
          pdf_url?: string | null;
          created_at?: string;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_invoices_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      twilio_balance_topups: {
        Row: {
          id: string;
          business_id: string;
          amount_cents: number;
          credited_cents: number;
          fee_cents: number;
          charged_cents: number | null;
          stripe_payment_intent_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          amount_cents: number;
          credited_cents: number;
          fee_cents?: number;
          charged_cents?: number | null;
          stripe_payment_intent_id?: string | null;
          status: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          amount_cents?: number;
          credited_cents?: number;
          fee_cents?: number;
          charged_cents?: number | null;
          stripe_payment_intent_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "twilio_balance_topups_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      twilio_wallet_debits: {
        Row: {
          id: string;
          business_id: string;
          amount_cents: number;
          source_type: string;
          source_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          amount_cents: number;
          source_type: string;
          source_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          amount_cents?: number;
          source_type?: string;
          source_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "twilio_wallet_debits_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      email_send_log: {
        Row: {
          id: string;
          template_id: string | null;
          resend_id: string | null;
          to_email: string;
          subject: string;
          status: string;
          error_message: string | null;
          user_id: string | null;
          business_id: string | null;
          metadata: Json;
          created_at: string;
          delivered_at: string | null;
        };
        Insert: {
          id?: string;
          template_id?: string | null;
          resend_id?: string | null;
          to_email: string;
          subject: string;
          status: string;
          error_message?: string | null;
          user_id?: string | null;
          business_id?: string | null;
          metadata?: Json;
          created_at?: string;
          delivered_at?: string | null;
        };
        Update: {
          id?: string;
          template_id?: string | null;
          resend_id?: string | null;
          to_email?: string;
          subject?: string;
          status?: string;
          error_message?: string | null;
          user_id?: string | null;
          business_id?: string | null;
          metadata?: Json;
          created_at?: string;
          delivered_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_send_log_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_send_log_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: {
          id: string;
          name: string;
          category: string;
          description: string;
          subject_template: string;
          body_html_template: string | null;
          from_email: string | null;
          is_active: boolean;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          category: string;
          description?: string;
          subject_template: string;
          body_html_template?: string | null;
          from_email?: string | null;
          is_active?: boolean;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          description?: string;
          subject_template?: string;
          body_html_template?: string | null;
          from_email?: string | null;
          is_active?: boolean;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      marketing_templates: {
        Row: {
          id: string;
          name: string;
          subject_template: string;
          headline: string;
          greeting: string;
          body_template: string;
          cta_label: string;
          cta_url: string;
          from_email: string;
          feature_highlights: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          name?: string;
          subject_template: string;
          headline: string;
          greeting?: string;
          body_template: string;
          cta_label?: string;
          cta_url?: string;
          from_email?: string;
          feature_highlights?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          subject_template?: string;
          headline?: string;
          greeting?: string;
          body_template?: string;
          cta_label?: string;
          cta_url?: string;
          from_email?: string;
          feature_highlights?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      marketing_campaigns: {
        Row: {
          id: string;
          name: string;
          subject: string;
          template_snapshot: Json;
          from_email: string;
          sent_count: number;
          failed_count: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string;
          subject: string;
          template_snapshot?: Json;
          from_email?: string;
          sent_count?: number;
          failed_count?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          subject?: string;
          template_snapshot?: Json;
          from_email?: string;
          sent_count?: number;
          failed_count?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      marketing_campaign_recipients: {
        Row: {
          id: string;
          campaign_id: string;
          business_id: string | null;
          recipient_email: string;
          recipient_name: string;
          tracking_token: string;
          status: string;
          sent_at: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          open_count: number;
          click_count: number;
          resend_id: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          business_id?: string | null;
          recipient_email: string;
          recipient_name?: string;
          tracking_token: string;
          status?: string;
          sent_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          open_count?: number;
          click_count?: number;
          resend_id?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          business_id?: string | null;
          recipient_email?: string;
          recipient_name?: string;
          tracking_token?: string;
          status?: string;
          sent_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          open_count?: number;
          click_count?: number;
          resend_id?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_recipients_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "marketing_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketing_campaign_recipients_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      user_auth_devices: {
        Row: {
          id: string;
          user_id: string;
          device_fingerprint: string;
          device_label: string;
          user_agent: string | null;
          last_ip: string | null;
          first_seen_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_fingerprint: string;
          device_label: string;
          user_agent?: string | null;
          last_ip?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_fingerprint?: string;
          device_label?: string;
          user_agent?: string | null;
          last_ip?: string | null;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      google_calendar_connections: {
        Row: {
          id: string;
          business_id: string;
          google_calendar_status: GoogleCalendarStatus;
          google_account_email: string | null;
          calendar_id: string | null;
          calendar_summary: string | null;
          access_token: string | null;
          access_token_secret_key_name: string | null;
          refresh_token: string | null;
          refresh_token_secret_key_name: string | null;
          token_expires_at: string | null;
          connected_at: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          google_calendar_status?: GoogleCalendarStatus;
          google_account_email?: string | null;
          calendar_id?: string | null;
          calendar_summary?: string | null;
          access_token?: string | null;
          access_token_secret_key_name?: string | null;
          refresh_token?: string | null;
          refresh_token_secret_key_name?: string | null;
          token_expires_at?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          google_calendar_status?: GoogleCalendarStatus;
          google_account_email?: string | null;
          calendar_id?: string | null;
          calendar_summary?: string | null;
          access_token?: string | null;
          access_token_secret_key_name?: string | null;
          refresh_token?: string | null;
          refresh_token_secret_key_name?: string | null;
          token_expires_at?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "google_calendar_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      orzu_voice_numbers: {
        Row: {
          id: string;
          business_id: string;
          phone_number: string;
          phone_sid: string;
          country_code: string;
          forward_to_e164: string | null;
          forward_verified_at: string | null;
          forwarding_wizard_completed_at: string | null;
          monthly_price_cents: number;
          stripe_subscription_item_id: string | null;
          billing_status: "active" | "canceled";
          status: OrzuVoiceNumberStatus;
          voice_url: string | null;
          sms_url: string | null;
          provisioned_at: string | null;
          released_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          phone_number: string;
          phone_sid: string;
          country_code?: string;
          forward_to_e164?: string | null;
          forward_verified_at?: string | null;
          forwarding_wizard_completed_at?: string | null;
          monthly_price_cents: number;
          stripe_subscription_item_id?: string | null;
          billing_status?: "active" | "canceled";
          status?: OrzuVoiceNumberStatus;
          voice_url?: string | null;
          sms_url?: string | null;
          provisioned_at?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          phone_number?: string;
          phone_sid?: string;
          country_code?: string;
          forward_to_e164?: string | null;
          forward_verified_at?: string | null;
          forwarding_wizard_completed_at?: string | null;
          monthly_price_cents?: number;
          stripe_subscription_item_id?: string | null;
          billing_status?: "active" | "canceled";
          status?: OrzuVoiceNumberStatus;
          voice_url?: string | null;
          sms_url?: string | null;
          provisioned_at?: string | null;
          released_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orzu_voice_numbers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      twilio_connections: {
        Row: {
          id: string;
          business_id: string;
          twilio_status: TwilioConnectionStatus;
          auth_mode: TwilioAuthMode;
          billing_owner: TwilioBillingOwner;
          connected_account_sid: string | null;
          parent_account_sid: string | null;
          api_key_sid: string | null;
          api_key_secret_key_name: string | null;
          auth_token_secret_key_name: string | null;
          browser_twiml_app_sid: string | null;
          browser_phone_status: string;
          browser_phone_last_error: string | null;
          browser_phone_provisioned_at: string | null;
          account_friendly_name: string | null;
          phone_number: string | null;
          phone_sid: string | null;
          connected_at: string | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          twilio_status?: TwilioConnectionStatus;
          auth_mode?: TwilioAuthMode;
          billing_owner?: TwilioBillingOwner;
          connected_account_sid?: string | null;
          parent_account_sid?: string | null;
          api_key_sid?: string | null;
          api_key_secret_key_name?: string | null;
          auth_token_secret_key_name?: string | null;
          browser_twiml_app_sid?: string | null;
          browser_phone_status?: string;
          browser_phone_last_error?: string | null;
          browser_phone_provisioned_at?: string | null;
          account_friendly_name?: string | null;
          phone_number?: string | null;
          phone_sid?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          twilio_status?: TwilioConnectionStatus;
          auth_mode?: TwilioAuthMode;
          billing_owner?: TwilioBillingOwner;
          connected_account_sid?: string | null;
          parent_account_sid?: string | null;
          api_key_sid?: string | null;
          api_key_secret_key_name?: string | null;
          auth_token_secret_key_name?: string | null;
          browser_twiml_app_sid?: string | null;
          browser_phone_status?: string;
          browser_phone_last_error?: string | null;
          browser_phone_provisioned_at?: string | null;
          account_friendly_name?: string | null;
          phone_number?: string | null;
          phone_sid?: string | null;
          connected_at?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "twilio_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      twilio_number_subscriptions: {
        Row: {
          id: string;
          business_id: string;
          phone_number: string;
          phone_sid: string;
          country_code: string;
          monthly_price_cents: number;
          stripe_subscription_item_id: string | null;
          status: string;
          created_at: string;
          canceled_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          phone_number: string;
          phone_sid: string;
          country_code: string;
          monthly_price_cents: number;
          stripe_subscription_item_id?: string | null;
          status?: string;
          created_at?: string;
          canceled_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          phone_number?: string;
          phone_sid?: string;
          country_code?: string;
          monthly_price_cents?: number;
          stripe_subscription_item_id?: string | null;
          status?: string;
          created_at?: string;
          canceled_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "twilio_number_subscriptions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      website_form_connections: {
        Row: {
          id: string;
          business_id: string;
          webhook_token: string;
          api_key_hash: string;
          api_key_prefix: string;
          site_name: string | null;
          site_url: string | null;
          connection_status: WebsiteFormStatus;
          auto_follow_up_enabled: boolean;
          follow_up_channel: WebsiteFormFollowUp;
          connected_at: string | null;
          last_submission_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          webhook_token: string;
          api_key_hash: string;
          api_key_prefix?: string;
          site_name?: string | null;
          site_url?: string | null;
          connection_status?: WebsiteFormStatus;
          auto_follow_up_enabled?: boolean;
          follow_up_channel?: WebsiteFormFollowUp;
          connected_at?: string | null;
          last_submission_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          webhook_token?: string;
          api_key_hash?: string;
          api_key_prefix?: string;
          site_name?: string | null;
          site_url?: string | null;
          connection_status?: WebsiteFormStatus;
          auto_follow_up_enabled?: boolean;
          follow_up_channel?: WebsiteFormFollowUp;
          connected_at?: string | null;
          last_submission_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "website_form_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      internet_phone_connections: {
        Row: {
          id: string;
          business_id: string;
          public_id: string;
          connection_status: WebsiteFormStatus;
          display_name: string | null;
          greeting_message: string;
          primary_color: string;
          connected_at: string | null;
          last_call_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          public_id: string;
          connection_status?: WebsiteFormStatus;
          display_name?: string | null;
          greeting_message?: string;
          primary_color?: string;
          connected_at?: string | null;
          last_call_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          public_id?: string;
          connection_status?: WebsiteFormStatus;
          display_name?: string | null;
          greeting_message?: string;
          primary_color?: string;
          connected_at?: string | null;
          last_call_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "internet_phone_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      internet_phone_calls: {
        Row: {
          id: string;
          business_id: string;
          connection_id: string;
          room_name: string;
          visitor_id: string;
          status: string;
          contact_id: string | null;
          conversation_id: string | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          connection_id: string;
          room_name: string;
          visitor_id: string;
          status?: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          connection_id?: string;
          room_name?: string;
          visitor_id?: string;
          status?: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "internet_phone_calls_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "internet_phone_calls_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "internet_phone_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      website_chat_connections: {
        Row: {
          id: string;
          business_id: string;
          widget_token: string;
          api_key_hash: string | null;
          api_key_prefix: string;
          connection_status: WebsiteFormStatus;
          site_name: string | null;
          site_url: string | null;
          welcome_message: string;
          primary_color: string;
          widget_title: string;
          launcher_icon: string;
          position: string;
          connected_at: string | null;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          widget_token: string;
          api_key_hash?: string | null;
          api_key_prefix?: string;
          connection_status?: WebsiteFormStatus;
          site_name?: string | null;
          site_url?: string | null;
          welcome_message?: string;
          primary_color?: string;
          widget_title?: string;
          launcher_icon?: string;
          position?: string;
          connected_at?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          widget_token?: string;
          api_key_hash?: string | null;
          api_key_prefix?: string;
          connection_status?: WebsiteFormStatus;
          site_name?: string | null;
          site_url?: string | null;
          welcome_message?: string;
          primary_color?: string;
          widget_title?: string;
          launcher_icon?: string;
          position?: string;
          connected_at?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "website_chat_connections_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_drip_emails: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          drip_day: number;
          sent_at: string;
          drip_paused_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          drip_day: number;
          sent_at?: string;
          drip_paused_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          email?: string;
          drip_day?: number;
          sent_at?: string;
          drip_paused_at?: string | null;
        };
        Relationships: [];
      };
      conversation_follow_ups: {
        Row: {
          id: string;
          conversation_id: string;
          business_id: string;
          follow_up_day: number;
          sent_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          business_id: string;
          follow_up_day: number;
          sent_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          business_id?: string;
          follow_up_day?: number;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_follow_ups_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_follow_ups_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      follow_up_jobs: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string;
          channel: MessagingChannel;
          follow_up_day: number;
          scheduled_at: string;
          status: string;
          last_outbound_content: string;
          contact_name: string;
          attempt_count: number;
          max_attempts: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id: string;
          channel: MessagingChannel;
          follow_up_day: number;
          scheduled_at: string;
          status?: string;
          last_outbound_content?: string;
          contact_name?: string;
          attempt_count?: number;
          max_attempts?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string;
          channel?: MessagingChannel;
          follow_up_day?: number;
          scheduled_at?: string;
          status?: string;
          last_outbound_content?: string;
          contact_name?: string;
          attempt_count?: number;
          max_attempts?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follow_up_jobs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follow_up_jobs_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      event_reminder_jobs: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string;
          contact_id: string | null;
          event_id: string;
          channel: MessagingChannel;
          hours_before: number;
          scheduled_at: string;
          message_body: string;
          status: string;
          attempt_count: number;
          max_attempts: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id: string;
          contact_id?: string | null;
          event_id: string;
          channel: MessagingChannel;
          hours_before?: number;
          scheduled_at: string;
          message_body?: string;
          status?: string;
          attempt_count?: number;
          max_attempts?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string;
          contact_id?: string | null;
          event_id?: string;
          channel?: MessagingChannel;
          hours_before?: number;
          scheduled_at?: string;
          message_body?: string;
          status?: string;
          attempt_count?: number;
          max_attempts?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      canned_responses: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          content: string;
          channel: MessagingChannel | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          title: string;
          content: string;
          channel?: MessagingChannel | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          title?: string;
          content?: string;
          channel?: MessagingChannel | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "canned_responses_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          phone_number: string;
          email: string | null;
          tags: string[];
          custom_fields: Record<string, string>;
          lead_score: number | null;
          ai_summary: string | null;
          pipeline_stage: string;
          deal_value: number | null;
          expected_close_date: string | null;
          sentiment: string | null;
          channel: MessagingChannel;
          last_message_at: string | null;
          is_favorite: boolean;
          avatar_url: string | null;
          avatar_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          phone_number: string;
          email?: string | null;
          tags?: string[];
          custom_fields?: Record<string, string>;
          lead_score?: number | null;
          ai_summary?: string | null;
          pipeline_stage?: string;
          deal_value?: number | null;
          expected_close_date?: string | null;
          sentiment?: string | null;
          channel?: MessagingChannel;
          last_message_at?: string | null;
          is_favorite?: boolean;
          avatar_url?: string | null;
          avatar_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          phone_number?: string;
          email?: string | null;
          tags?: string[];
          custom_fields?: Record<string, string>;
          lead_score?: number | null;
          ai_summary?: string | null;
          pipeline_stage?: string;
          deal_value?: number | null;
          expected_close_date?: string | null;
          sentiment?: string | null;
          channel?: MessagingChannel;
          last_message_at?: string | null;
          is_favorite?: boolean;
          avatar_url?: string | null;
          avatar_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_channel_identities: {
        Row: {
          id: string;
          business_id: string;
          contact_id: string;
          channel: MessagingChannel;
          external_id: string;
          display_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          contact_id: string;
          channel: MessagingChannel;
          external_id: string;
          display_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          contact_id?: string;
          channel?: MessagingChannel;
          external_id?: string;
          display_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_channel_identities_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_channel_identities_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          business_id: string;
          contact_id: string;
          channel: MessagingChannel;
          status: ConversationStatus;
          internal_note: string | null;
          assigned_to: string | null;
          last_read_at: string | null;
          last_message_preview: string | null;
          last_message_at: string | null;
          last_message_sender_type: MessageSenderType | null;
          last_message_ai_generated: boolean;
          last_client_message_at: string | null;
          unread_count: number;
          last_sync_message_at: string | null;
          last_sync_message_id: string | null;
          total_message_count: number;
          ai_summary: string | null;
          ai_summary_updated_at: string | null;
          ai_summary_message_count: number;
          ai_auto_reply_paused: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          contact_id: string;
          channel?: MessagingChannel;
          status?: ConversationStatus;
          internal_note?: string | null;
          assigned_to?: string | null;
          last_read_at?: string | null;
          last_message_preview?: string | null;
          last_message_at?: string | null;
          last_message_sender_type?: MessageSenderType | null;
          last_message_ai_generated?: boolean;
          last_client_message_at?: string | null;
          unread_count?: number;
          last_sync_message_at?: string | null;
          last_sync_message_id?: string | null;
          total_message_count?: number;
          ai_summary?: string | null;
          ai_summary_updated_at?: string | null;
          ai_summary_message_count?: number;
          ai_auto_reply_paused?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          contact_id?: string;
          channel?: MessagingChannel;
          status?: ConversationStatus;
          internal_note?: string | null;
          assigned_to?: string | null;
          last_read_at?: string | null;
          last_message_preview?: string | null;
          last_message_at?: string | null;
          last_message_sender_type?: MessageSenderType | null;
          last_message_ai_generated?: boolean;
          last_client_message_at?: string | null;
          unread_count?: number;
          last_sync_message_at?: string | null;
          last_sync_message_id?: string | null;
          total_message_count?: number;
          ai_summary?: string | null;
          ai_summary_updated_at?: string | null;
          ai_summary_message_count?: number;
          ai_auto_reply_paused?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_reads: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string;
          user_id: string;
          last_read_at: string | null;
          unread_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id: string;
          user_id: string;
          last_read_at?: string | null;
          unread_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string;
          user_id?: string;
          last_read_at?: string | null;
          unread_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_reads_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_deals: {
        Row: {
          id: string;
          business_id: string;
          contact_id: string;
          title: string;
          value: number | null;
          currency: string;
          stage: string;
          expected_close_date: string | null;
          status: string;
          is_primary: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          contact_id: string;
          title?: string;
          value?: number | null;
          currency?: string;
          stage?: string;
          expected_close_date?: string | null;
          status?: string;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          contact_id?: string;
          title?: string;
          value?: number | null;
          currency?: string;
          stage?: string;
          expected_close_date?: string | null;
          status?: string;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_deals_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_deals_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_orders: {
        Row: {
          id: string;
          business_id: string;
          contact_id: string | null;
          conversation_id: string | null;
          title: string;
          description: string | null;
          source: string;
          status: string;
          amount: number | null;
          currency: string;
          payload: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          title?: string;
          description?: string | null;
          source?: string;
          status?: string;
          amount?: number | null;
          currency?: string;
          payload?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          contact_id?: string | null;
          conversation_id?: string | null;
          title?: string;
          description?: string | null;
          source?: string;
          status?: string;
          amount?: number | null;
          currency?: string;
          payload?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_orders_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_orders_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_orders_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_tasks: {
        Row: {
          id: string;
          business_id: string;
          contact_id: string;
          title: string;
          due_at: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          contact_id: string;
          title: string;
          due_at?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          contact_id?: string;
          title?: string;
          due_at?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_tasks_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "crm_tasks_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          channel: MessagingChannel;
          sender_type: MessageSenderType;
          content: string;
          email_subject: string | null;
          ai_generated: boolean;
          ai_agent_snapshot: unknown | null;
          deleted_for_all_at: string | null;
          hidden_for_business: boolean;
          edited_at: string | null;
          is_edited: boolean;
          external_message_id: string | null;
          business_id: string | null;
          created_at: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          channel?: MessagingChannel;
          sender_type: MessageSenderType;
          content: string;
          email_subject?: string | null;
          ai_generated?: boolean;
          ai_agent_snapshot?: unknown | null;
          deleted_for_all_at?: string | null;
          hidden_for_business?: boolean;
          edited_at?: string | null;
          is_edited?: boolean;
          external_message_id?: string | null;
          business_id?: string | null;
          created_at?: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          channel?: MessagingChannel;
          sender_type?: MessageSenderType;
          content?: string;
          email_subject?: string | null;
          ai_generated?: boolean;
          ai_agent_snapshot?: unknown | null;
          deleted_for_all_at?: string | null;
          hidden_for_business?: boolean;
          edited_at?: string | null;
          is_edited?: boolean;
          external_message_id?: string | null;
          business_id?: string | null;
          created_at?: string;
          sent_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      message_deliveries: {
        Row: {
          id: string;
          message_id: string;
          business_id: string;
          channel: MessagingChannel;
          conversation_id: string | null;
          status: MessageDeliveryStatus;
          attempt_count: number;
          max_attempts: number;
          next_attempt_at: string;
          last_error: string | null;
          provider_message_id: string | null;
          sent_at: string | null;
          failed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          business_id: string;
          channel: MessagingChannel;
          conversation_id?: string | null;
          status?: MessageDeliveryStatus;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          last_error?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          failed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          business_id?: string;
          channel?: MessagingChannel;
          conversation_id?: string | null;
          status?: MessageDeliveryStatus;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          last_error?: string | null;
          provider_message_id?: string | null;
          sent_at?: string | null;
          failed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_deliveries_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: true;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_deliveries_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      message_attachments: {
        Row: {
          id: string;
          message_id: string;
          business_id: string;
          kind: MessageAttachmentKind;
          mime_type: string;
          file_name: string;
          storage_path: string | null;
          size_bytes: number | null;
          duration_sec: number | null;
          provider_media_id: string | null;
          provider_media_url: string | null;
          provider_media_url_expires_at: string | null;
          status: MessageAttachmentStatus;
          thumbnail_path: string | null;
          thumb_width: number | null;
          thumb_height: number | null;
          retry_count: number;
          max_retries: number;
          last_error: string | null;
          next_retry_at: string | null;
          hydration_context: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          business_id: string;
          kind: MessageAttachmentKind;
          mime_type?: string;
          file_name?: string;
          storage_path?: string | null;
          size_bytes?: number | null;
          duration_sec?: number | null;
          provider_media_id?: string | null;
          provider_media_url?: string | null;
          provider_media_url_expires_at?: string | null;
          status?: MessageAttachmentStatus;
          thumbnail_path?: string | null;
          thumb_width?: number | null;
          thumb_height?: number | null;
          retry_count?: number;
          max_retries?: number;
          last_error?: string | null;
          next_retry_at?: string | null;
          hydration_context?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          business_id?: string;
          kind?: MessageAttachmentKind;
          mime_type?: string;
          file_name?: string;
          storage_path?: string | null;
          size_bytes?: number | null;
          duration_sec?: number | null;
          provider_media_id?: string | null;
          provider_media_url?: string | null;
          provider_media_url_expires_at?: string | null;
          thumbnail_path?: string | null;
          thumb_width?: number | null;
          thumb_height?: number | null;
          status?: MessageAttachmentStatus;
          retry_count?: number;
          max_retries?: number;
          last_error?: string | null;
          next_retry_at?: string | null;
          hydration_context?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: true;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_attachments_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      inbound_webhook_queue: {
        Row: {
          id: string;
          channel: MessagingChannel;
          idempotency_key: string;
          payload: Record<string, unknown>;
          metadata: Record<string, unknown>;
          status: WebhookQueueStatus;
          attempt_count: number;
          max_attempts: number;
          next_attempt_at: string;
          last_error: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          channel: MessagingChannel;
          idempotency_key: string;
          payload: Record<string, unknown>;
          metadata?: Record<string, unknown>;
          status?: WebhookQueueStatus;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          last_error?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          channel?: MessagingChannel;
          idempotency_key?: string;
          payload?: Record<string, unknown>;
          metadata?: Record<string, unknown>;
          status?: WebhookQueueStatus;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          last_error?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_reply_jobs: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string;
          channel: MessagingChannel;
          pending_messages: string[];
          status: WebhookQueueStatus;
          attempt_count: number;
          max_attempts: number;
          next_attempt_at: string;
          needs_reprocess: boolean;
          last_error: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id: string;
          channel: MessagingChannel;
          pending_messages?: string[];
          status?: WebhookQueueStatus;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          needs_reprocess?: boolean;
          last_error?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string;
          channel?: MessagingChannel;
          pending_messages?: string[];
          status?: WebhookQueueStatus;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          needs_reprocess?: boolean;
          last_error?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ai_orchestration_jobs: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string;
          channel: MessagingChannel;
          client_message: string;
          idempotency_key: string;
          status: WebhookQueueStatus;
          attempt_count: number;
          max_attempts: number;
          next_attempt_at: string;
          last_error: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id: string;
          channel: MessagingChannel;
          client_message: string;
          idempotency_key: string;
          status?: WebhookQueueStatus;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          last_error?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string;
          channel?: MessagingChannel;
          client_message?: string;
          idempotency_key?: string;
          status?: WebhookQueueStatus;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          last_error?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_signed_url_cache: {
        Row: {
          storage_path: string;
          signed_url: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          storage_path: string;
          signed_url: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          storage_path?: string;
          signed_url?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          business_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          business_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_crm_idempotency: {
        Row: {
          id: string;
          business_id: string;
          idempotency_key: string;
          action_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          idempotency_key: string;
          action_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          idempotency_key?: string;
          action_type?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_crm_idempotency_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_tool_audit_events: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string | null;
          contact_id: string | null;
          tool_name: string;
          success: boolean;
          label: string | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          tool_name: string;
          success?: boolean;
          label?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          tool_name?: string;
          success?: boolean;
          label?: string | null;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_tool_audit_events_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_tool_audit_events_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_tool_audit_events_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_runs: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string | null;
          contact_id: string | null;
          ai_agent_snapshot: unknown | null;
          channel: string;
          client_message: string;
          routing_method: string | null;
          actions: unknown;
          success: boolean;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          ai_agent_snapshot?: unknown | null;
          channel: string;
          client_message: string;
          routing_method?: string | null;
          actions?: unknown;
          success?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          ai_agent_snapshot?: unknown | null;
          channel?: string;
          client_message?: string;
          routing_method?: string | null;
          actions?: unknown;
          success?: boolean;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_runs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      app_secrets: {
        Row: {
          id: string;
          key_name: string;
          encrypted_value: string;
          description: string;
          is_active: boolean;
          last_used_at: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          key_name: string;
          encrypted_value: string;
          description?: string;
          is_active?: boolean;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          key_name?: string;
          encrypted_value?: string;
          description?: string;
          is_active?: boolean;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      app_secret_audit_log: {
        Row: {
          id: string;
          secret_id: string | null;
          key_name: string;
          action: string;
          actor_user_id: string | null;
          actor_email: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          secret_id?: string | null;
          key_name: string;
          action: string;
          actor_user_id?: string | null;
          actor_email?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          secret_id?: string | null;
          key_name?: string;
          action?: string;
          actor_user_id?: string | null;
          actor_email?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_announcement_dismissals: {
        Row: {
          announcement_id: string;
          user_id: string;
          dismissed_at: string;
        };
        Insert: {
          announcement_id: string;
          user_id: string;
          dismissed_at?: string;
        };
        Update: {
          announcement_id?: string;
          user_id?: string;
          dismissed_at?: string;
        };
        Relationships: [];
      };
      platform_announcements: {
        Row: {
          id: string;
          title: string;
          body: string;
          severity: string;
          target_audience: string;
          target_business_ids: string[];
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          severity?: string;
          target_audience?: string;
          target_business_ids?: string[];
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          severity?: string;
          target_audience?: string;
          target_business_ids?: string[];
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_subscription_plans: {
        Row: {
          id: string;
          label: string;
          tagline: string;
          price_monthly_cents: number;
          sort_order: number;
          is_active: boolean;
          is_public: boolean;
          highlighted: boolean;
          stripe_product_id: string | null;
          stripe_price_id: string | null;
          entitlements: Json;
          features: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          label: string;
          tagline?: string;
          price_monthly_cents?: number;
          sort_order?: number;
          is_active?: boolean;
          is_public?: boolean;
          highlighted?: boolean;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          entitlements: Json;
          features?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          tagline?: string;
          price_monthly_cents?: number;
          sort_order?: number;
          is_active?: boolean;
          is_public?: boolean;
          highlighted?: boolean;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          entitlements?: Json;
          features?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_subscription_addons: {
        Row: {
          id: string;
          label: string;
          description: string;
          price_monthly_cents: number;
          sort_order: number;
          is_active: boolean;
          stripe_product_id: string | null;
          stripe_price_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          label: string;
          description?: string;
          price_monthly_cents?: number;
          sort_order?: number;
          is_active?: boolean;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          description?: string;
          price_monthly_cents?: number;
          sort_order?: number;
          is_active?: boolean;
          stripe_product_id?: string | null;
          stripe_price_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_error_events: {
        Row: {
          id: string;
          fingerprint: string;
          severity: string;
          status: string;
          environment: string;
          module: string;
          category: string;
          source: string;
          title: string;
          message: string;
          description: string;
          root_cause: string | null;
          suggested_fix: string | null;
          impact: string | null;
          recurrence_risk: string | null;
          business_id: string | null;
          user_id: string | null;
          conversation_id: string | null;
          session_id: string | null;
          correlation_id: string | null;
          trace_id: string | null;
          deployment_id: string | null;
          commit_hash: string | null;
          app_version: string | null;
          region: string | null;
          http_status: number | null;
          method: string | null;
          path: string | null;
          duration_ms: number | null;
          retry_count: number;
          occurrences: number;
          assigned_to: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          browser: string | null;
          device: string | null;
          ip: string | null;
          country: string | null;
          language: string | null;
          request_headers: Json;
          request_body: Json | null;
          response_body: Json | null;
          stack_trace: string | null;
          raw_log: string | null;
          terminal: Json;
          context: Json;
          ai: Json;
          first_seen_at: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fingerprint: string;
          severity?: string;
          status?: string;
          environment?: string;
          module?: string;
          category?: string;
          source?: string;
          title: string;
          message?: string;
          description?: string;
          root_cause?: string | null;
          suggested_fix?: string | null;
          impact?: string | null;
          recurrence_risk?: string | null;
          business_id?: string | null;
          user_id?: string | null;
          conversation_id?: string | null;
          session_id?: string | null;
          correlation_id?: string | null;
          trace_id?: string | null;
          deployment_id?: string | null;
          commit_hash?: string | null;
          app_version?: string | null;
          region?: string | null;
          http_status?: number | null;
          method?: string | null;
          path?: string | null;
          duration_ms?: number | null;
          retry_count?: number;
          occurrences?: number;
          assigned_to?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          browser?: string | null;
          device?: string | null;
          ip?: string | null;
          country?: string | null;
          language?: string | null;
          request_headers?: Json;
          request_body?: Json | null;
          response_body?: Json | null;
          stack_trace?: string | null;
          raw_log?: string | null;
          terminal?: Json;
          context?: Json;
          ai?: Json;
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fingerprint?: string;
          severity?: string;
          status?: string;
          environment?: string;
          module?: string;
          category?: string;
          source?: string;
          title?: string;
          message?: string;
          description?: string;
          root_cause?: string | null;
          suggested_fix?: string | null;
          impact?: string | null;
          recurrence_risk?: string | null;
          business_id?: string | null;
          user_id?: string | null;
          conversation_id?: string | null;
          session_id?: string | null;
          correlation_id?: string | null;
          trace_id?: string | null;
          deployment_id?: string | null;
          commit_hash?: string | null;
          app_version?: string | null;
          region?: string | null;
          http_status?: number | null;
          method?: string | null;
          path?: string | null;
          duration_ms?: number | null;
          retry_count?: number;
          occurrences?: number;
          assigned_to?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          browser?: string | null;
          device?: string | null;
          ip?: string | null;
          country?: string | null;
          language?: string | null;
          request_headers?: Json;
          request_body?: Json | null;
          response_body?: Json | null;
          stack_trace?: string | null;
          raw_log?: string | null;
          terminal?: Json;
          context?: Json;
          ai?: Json;
          first_seen_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_error_events_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_business_admin_audit_log: {
        Row: {
          id: string;
          business_id: string | null;
          action: string;
          actor_user_id: string | null;
          actor_email: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id?: string | null;
          action: string;
          actor_user_id?: string | null;
          actor_email?: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string | null;
          action?: string;
          actor_user_id?: string | null;
          actor_email?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_business_controls: {
        Row: {
          business_id: string;
          account_status: string;
          ai_enabled: boolean;
          voice_enabled: boolean;
          sms_enabled: boolean;
          automations_enabled: boolean;
          outbound_ai_enabled: boolean;
          admin_notes: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          business_id: string;
          account_status?: string;
          ai_enabled?: boolean;
          voice_enabled?: boolean;
          sms_enabled?: boolean;
          automations_enabled?: boolean;
          outbound_ai_enabled?: boolean;
          admin_notes?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          business_id?: string;
          account_status?: string;
          ai_enabled?: boolean;
          voice_enabled?: boolean;
          sms_enabled?: boolean;
          automations_enabled?: boolean;
          outbound_ai_enabled?: boolean;
          admin_notes?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      platform_support_messages: {
        Row: {
          id: string;
          thread_id: string;
          sender_type: string;
          sender_admin_user_id: string | null;
          sender_business_user_id: string | null;
          content: string;
          read_by_platform_at: string | null;
          read_by_business_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          sender_type: string;
          sender_admin_user_id?: string | null;
          sender_business_user_id?: string | null;
          content: string;
          read_by_platform_at?: string | null;
          read_by_business_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          sender_type?: string;
          sender_admin_user_id?: string | null;
          sender_business_user_id?: string | null;
          content?: string;
          read_by_platform_at?: string | null;
          read_by_business_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_support_threads: {
        Row: {
          id: string;
          business_id: string;
          subject: string;
          last_message_at: string | null;
          unread_by_platform: number;
          unread_by_business: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          subject?: string;
          last_message_at?: string | null;
          unread_by_platform?: number;
          unread_by_business?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          subject?: string;
          last_message_at?: string | null;
          unread_by_platform?: number;
          unread_by_business?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          user_id: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          user_id?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      platform_legal_pages: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string;
          footer_label: string;
          sections: unknown;
          sort_order: number;
          published: boolean;
          show_in_footer: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string;
          footer_label?: string;
          sections?: unknown;
          sort_order?: number;
          published?: boolean;
          show_in_footer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string;
          footer_label?: string;
          sections?: unknown;
          sort_order?: number;
          published?: boolean;
          show_in_footer?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_prompts: {
        Row: {
          id: string;
          prompt_key: string;
          version: number;
          content: string;
          is_active: boolean;
          usage_count: number;
          last_used_at: string | null;
          change_note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          prompt_key: string;
          version: number;
          content: string;
          is_active?: boolean;
          usage_count?: number;
          last_used_at?: string | null;
          change_note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          prompt_key?: string;
          version?: number;
          content?: string;
          is_active?: boolean;
          usage_count?: number;
          last_used_at?: string | null;
          change_note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          description: string;
          location: string;
          start_at: string;
          end_at: string;
          timezone: string;
          is_all_day: boolean;
          google_event_id: string | null;
          google_html_link: string | null;
          source: string;
          created_at: string;
          updated_at: string;
          resource_id: string | null;
          booking_page_id: string | null;
          customer_name: string;
          customer_email: string;
          is_booking: boolean;
        };
        Insert: {
          id?: string;
          business_id: string;
          title: string;
          description?: string;
          location?: string;
          start_at: string;
          end_at: string;
          timezone?: string;
          is_all_day?: boolean;
          google_event_id?: string | null;
          google_html_link?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
          resource_id?: string | null;
          booking_page_id?: string | null;
          customer_name?: string;
          customer_email?: string;
          is_booking?: boolean;
        };
        Update: {
          id?: string;
          business_id?: string;
          title?: string;
          description?: string;
          location?: string;
          start_at?: string;
          end_at?: string;
          timezone?: string;
          is_all_day?: boolean;
          google_event_id?: string | null;
          google_html_link?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
          resource_id?: string | null;
          booking_page_id?: string | null;
          customer_name?: string;
          customer_email?: string;
          is_booking?: boolean;
        };
        Relationships: [];
      };
      calendar_tasks: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          description: string;
          start_at: string | null;
          end_at: string | null;
          due_at: string | null;
          status: string;
          google_event_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          title: string;
          description?: string;
          start_at?: string | null;
          end_at?: string | null;
          due_at?: string | null;
          status?: string;
          google_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          title?: string;
          description?: string;
          start_at?: string | null;
          end_at?: string | null;
          due_at?: string | null;
          status?: string;
          google_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_booking_setup: {
        Row: {
          business_id: string;
          business_type: string;
          business_type_label: string;
          operating_hours_note: string;
          generated_from_knowledge_at: string | null;
          booking_timezone: string;
          slot_buffer_minutes: number;
          advance_booking_days: number;
          business_hours_enabled: boolean;
          business_hours_start: string;
          business_hours_end: string;
          business_days: number[];
          booking_page_title: string;
          slot_duration_minutes: number;
          booking_page_published: boolean;
          weekly_schedule: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          business_type?: string;
          business_type_label?: string;
          operating_hours_note?: string;
          generated_from_knowledge_at?: string | null;
          booking_timezone?: string;
          slot_buffer_minutes?: number;
          advance_booking_days?: number;
          business_hours_enabled?: boolean;
          business_hours_start?: string;
          business_hours_end?: string;
          business_days?: number[];
          booking_page_title?: string;
          slot_duration_minutes?: number;
          booking_page_published?: boolean;
          weekly_schedule?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          business_type?: string;
          business_type_label?: string;
          operating_hours_note?: string;
          generated_from_knowledge_at?: string | null;
          booking_timezone?: string;
          slot_buffer_minutes?: number;
          advance_booking_days?: number;
          business_hours_enabled?: boolean;
          business_hours_start?: string;
          business_hours_end?: string;
          business_days?: number[];
          booking_page_title?: string;
          slot_duration_minutes?: number;
          booking_page_published?: boolean;
          weekly_schedule?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_booking_setup_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_pages: {
        Row: {
          id: string;
          business_id: string;
          slug: string;
          title: string;
          business_type: string;
          business_type_label: string;
          slot_duration_minutes: number;
          slot_buffer_minutes: number;
          advance_booking_days: number;
          booking_timezone: string;
          weekly_schedule: unknown;
          form_fields: unknown;
          published: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          slug: string;
          title: string;
          business_type?: string;
          business_type_label?: string;
          slot_duration_minutes?: number;
          slot_buffer_minutes?: number;
          advance_booking_days?: number;
          booking_timezone?: string;
          weekly_schedule?: unknown;
          form_fields?: unknown;
          published?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          slug?: string;
          title?: string;
          business_type?: string;
          business_type_label?: string;
          slot_duration_minutes?: number;
          slot_buffer_minutes?: number;
          advance_booking_days?: number;
          booking_timezone?: string;
          weekly_schedule?: unknown;
          form_fields?: unknown;
          published?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_pages_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_calendar_resources: {
        Row: {
          id: string;
          business_id: string;
          booking_page_id: string | null;
          resource_type: string;
          name: string;
          description: string;
          capacity: number;
          duration_minutes: number;
          sort_order: number;
          active: boolean;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          booking_page_id?: string | null;
          resource_type: string;
          name: string;
          description?: string;
          capacity?: number;
          duration_minutes?: number;
          sort_order?: number;
          active?: boolean;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          booking_page_id?: string | null;
          resource_type?: string;
          name?: string;
          description?: string;
          capacity?: number;
          duration_minutes?: number;
          sort_order?: number;
          active?: boolean;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_calendar_resources_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_calendar_resources_booking_page_id_fkey";
            columns: ["booking_page_id"];
            isOneToOne: false;
            referencedRelation: "booking_pages";
            referencedColumns: ["id"];
          },
        ];
      };
      business_notifications: {
        Row: {
          id: string;
          business_id: string;
          kind: string;
          conversation_id: string;
          contact_id: string | null;
          channel: string;
          contact_name: string;
          title: string;
          body: string;
          details: Json;
          source_id: string | null;
          read_at: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          kind: string;
          conversation_id: string;
          contact_id?: string | null;
          channel: string;
          contact_name?: string;
          title: string;
          body?: string;
          details?: Json;
          source_id?: string | null;
          read_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          kind?: string;
          conversation_id?: string;
          contact_id?: string | null;
          channel?: string;
          contact_name?: string;
          title?: string;
          body?: string;
          details?: Json;
          source_id?: string | null;
          read_at?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_notifications_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_notifications_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_notifications_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_human_requests: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string;
          contact_id: string | null;
          channel: string;
          contact_name: string;
          reason: string;
          message_preview: string;
          created_at: string;
          status: string;
          accepted_at: string | null;
          accepted_by: string | null;
          escalate_count: number;
          last_escalated_at: string | null;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id: string;
          contact_id?: string | null;
          channel: string;
          contact_name?: string;
          reason: string;
          message_preview?: string;
          created_at?: string;
          status?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          escalate_count?: number;
          last_escalated_at?: string | null;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string;
          contact_id?: string | null;
          channel?: string;
          contact_name?: string;
          reason?: string;
          message_preview?: string;
          created_at?: string;
          status?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          escalate_count?: number;
          last_escalated_at?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_human_requests_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_human_requests_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_human_requests_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_assistant_profile: {
        Row: {
          business_id: string;
          name: string;
          system_prompt: string;
          communication_style: string;
          language: string;
          reply_wait_ms: number;
          schedule_enabled: boolean;
          schedule_timezone: string;
          schedule_slots: Json;
          crm_update_mode: string;
          ai_intensity: string;
          fallback_reply_message: string | null;
          can_reply: boolean;
          can_create_task: boolean;
          can_create_deal: boolean;
          can_update_contact: boolean;
          can_add_note: boolean;
          can_add_internal_note: boolean;
          can_create_calendar_event: boolean;
          can_request_human: boolean;
          can_notify_owner: boolean;
          can_notify_on_actions: boolean;
          can_summarize_actions_in_chat: boolean;
          collection_niche: string;
          data_collection_fields: Json;
          can_send_proactive_message: boolean;
          voice_reply_enabled: boolean;
          elevenlabs_voice_id: string | null;
          elevenlabs_voice_name: string | null;
          voice_reply_mode: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          name?: string;
          system_prompt: string;
          communication_style?: string;
          language?: string;
          reply_wait_ms?: number;
          schedule_enabled?: boolean;
          schedule_timezone?: string;
          schedule_slots?: Json;
          crm_update_mode?: string;
          ai_intensity?: string;
          fallback_reply_message?: string | null;
          can_reply?: boolean;
          can_create_task?: boolean;
          can_create_deal?: boolean;
          can_update_contact?: boolean;
          can_add_note?: boolean;
          can_add_internal_note?: boolean;
          can_create_calendar_event?: boolean;
          can_request_human?: boolean;
          can_notify_owner?: boolean;
          can_notify_on_actions?: boolean;
          can_summarize_actions_in_chat?: boolean;
          collection_niche?: string;
          data_collection_fields?: Json;
          can_send_proactive_message?: boolean;
          voice_reply_enabled?: boolean;
          elevenlabs_voice_id?: string | null;
          elevenlabs_voice_name?: string | null;
          voice_reply_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          name?: string;
          system_prompt?: string;
          communication_style?: string;
          language?: string;
          reply_wait_ms?: number;
          schedule_enabled?: boolean;
          schedule_timezone?: string;
          schedule_slots?: Json;
          crm_update_mode?: string;
          ai_intensity?: string;
          fallback_reply_message?: string | null;
          can_reply?: boolean;
          can_create_task?: boolean;
          can_create_deal?: boolean;
          can_update_contact?: boolean;
          can_add_note?: boolean;
          can_add_internal_note?: boolean;
          can_create_calendar_event?: boolean;
          can_request_human?: boolean;
          can_notify_owner?: boolean;
          can_notify_on_actions?: boolean;
          can_summarize_actions_in_chat?: boolean;
          collection_niche?: string;
          data_collection_fields?: Json;
          can_send_proactive_message?: boolean;
          voice_reply_enabled?: boolean;
          elevenlabs_voice_id?: string | null;
          elevenlabs_voice_name?: string | null;
          voice_reply_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_assistant_profile_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_settings: {
        Row: {
          id: string;
          business_id: string;
          channel: MessagingChannel;
          provider: string;
          model: string;
          language: string;
          system_prompt: string;
          ai_enabled: boolean;
          channel_overrides_enabled: boolean;
          reply_wait_ms: number | null;
          can_create_task: boolean | null;
          can_create_deal: boolean | null;
          can_update_contact: boolean | null;
          can_add_note: boolean | null;
          can_add_internal_note: boolean | null;
          can_create_calendar_event: boolean | null;
          can_request_human: boolean | null;
          can_notify_owner: boolean | null;
          can_notify_on_actions: boolean | null;
          can_summarize_actions_in_chat: boolean | null;
          can_send_proactive_message: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          channel?: MessagingChannel;
          provider?: string;
          model: string;
          language: string;
          system_prompt: string;
          ai_enabled?: boolean;
          channel_overrides_enabled?: boolean;
          reply_wait_ms?: number | null;
          can_create_task?: boolean | null;
          can_create_deal?: boolean | null;
          can_update_contact?: boolean | null;
          can_add_note?: boolean | null;
          can_add_internal_note?: boolean | null;
          can_create_calendar_event?: boolean | null;
          can_request_human?: boolean | null;
          can_notify_owner?: boolean | null;
          can_notify_on_actions?: boolean | null;
          can_summarize_actions_in_chat?: boolean | null;
          can_send_proactive_message?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          channel?: MessagingChannel;
          provider?: string;
          model?: string;
          language?: string;
          system_prompt?: string;
          ai_enabled?: boolean;
          channel_overrides_enabled?: boolean;
          reply_wait_ms?: number | null;
          can_create_task?: boolean | null;
          can_create_deal?: boolean | null;
          can_update_contact?: boolean | null;
          can_add_note?: boolean | null;
          can_add_internal_note?: boolean | null;
          can_create_calendar_event?: boolean | null;
          can_request_human?: boolean | null;
          can_notify_owner?: boolean | null;
          can_notify_on_actions?: boolean | null;
          can_summarize_actions_in_chat?: boolean | null;
          can_send_proactive_message?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_settings_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_usage_logs: {
        Row: {
          id: string;
          business_id: string;
          conversation_id: string | null;
          provider: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          estimated_cost_usd: number;
          billing_source: string;
          call_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          conversation_id?: string | null;
          provider: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          estimated_cost_usd?: number;
          billing_source?: string;
          call_type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          conversation_id?: string | null;
          provider?: string;
          model?: string;
          input_tokens?: number;
          output_tokens?: number;
          estimated_cost_usd?: number;
          billing_source?: string;
          call_type?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_usage_logs_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      business_ai_config: {
        Row: {
          business_id: string;
          sales_agent_enabled: boolean;
          bant_threshold: number;
          auto_qualify_pipeline: boolean;
          auto_task_enabled: boolean;
          auto_task_threshold: number;
          auto_deal_enabled: boolean;
          auto_deal_threshold: number;
          sentiment_analysis_enabled: boolean;
          follow_up_agent_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          sales_agent_enabled?: boolean;
          bant_threshold?: number;
          auto_qualify_pipeline?: boolean;
          auto_task_enabled?: boolean;
          auto_task_threshold?: number;
          auto_deal_enabled?: boolean;
          auto_deal_threshold?: number;
          sentiment_analysis_enabled?: boolean;
          follow_up_agent_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          sales_agent_enabled?: boolean;
          bant_threshold?: number;
          auto_qualify_pipeline?: boolean;
          auto_task_enabled?: boolean;
          auto_task_threshold?: number;
          auto_deal_enabled?: boolean;
          auto_deal_threshold?: number;
          sentiment_analysis_enabled?: boolean;
          follow_up_agent_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_ai_config_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_ai_provider_keys: {
        Row: {
          business_id: string;
          provider: string;
          api_key_encrypted: string;
          api_key_preview: string | null;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          provider: string;
          api_key_encrypted: string;
          api_key_preview?: string | null;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          provider?: string;
          api_key_encrypted?: string;
          api_key_preview?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_ai_provider_keys_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_analytics: {
        Row: {
          business_id: string;
          channel: MessagingChannel;
          total_messages: number;
          total_contacts: number;
          ai_replies: number;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          channel: MessagingChannel;
          total_messages?: number;
          total_contacts?: number;
          ai_replies?: number;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          channel?: MessagingChannel;
          total_messages?: number;
          total_contacts?: number;
          ai_replies?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channel_analytics_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_runs: {
        Row: {
          id: string;
          automation_id: string;
          business_id: string;
          conversation_id: string | null;
          contact_id: string | null;
          trigger_type: string;
          action_type: string;
          status: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          automation_id: string;
          business_id: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          trigger_type: string;
          action_type: string;
          status?: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          automation_id?: string;
          business_id?: string;
          conversation_id?: string | null;
          contact_id?: string | null;
          trigger_type?: string;
          action_type?: string;
          status?: string;
          detail?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey";
            columns: ["automation_id"];
            isOneToOne: false;
            referencedRelation: "automations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automation_runs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      automations: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          trigger_type: string;
          action_type: string;
          enabled: boolean;
          config: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          trigger_type: string;
          action_type: string;
          enabled?: boolean;
          config?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          trigger_type?: string;
          action_type?: string;
          enabled?: boolean;
          config?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automations_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string | null;
          invited_email: string;
          role: string;
          status: string;
          permissions: unknown;
          access_starts_at: string | null;
          access_ends_at: string | null;
          invite_token: string | null;
          invite_expires_at: string | null;
          invited_at: string | null;
          accepted_at: string | null;
          team_onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id?: string | null;
          invited_email: string;
          role?: string;
          status?: string;
          permissions?: unknown;
          access_starts_at?: string | null;
          access_ends_at?: string | null;
          invite_token?: string | null;
          invite_expires_at?: string | null;
          invited_at?: string | null;
          accepted_at?: string | null;
          team_onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string | null;
          invited_email?: string;
          role?: string;
          status?: string;
          permissions?: unknown;
          access_starts_at?: string | null;
          access_ends_at?: string | null;
          invite_token?: string | null;
          invite_expires_at?: string | null;
          invited_at?: string | null;
          accepted_at?: string | null;
          team_onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_agent_config: {
        Row: {
          business_id: string;
          enabled: boolean;
          provider: string;
          phone_number: string | null;
          outbound_enabled: boolean;
          inbound_enabled: boolean;
          callback_after_order: boolean;
          callback_delay_minutes: number;
          outbound_script: string;
          inbound_greeting: string;
          retell_agent_id: string | null;
          vapi_assistant_id: string | null;
          twilio_phone_sid: string | null;
          ai_enabled: boolean;
          voice_language: string;
          voice_system_prompt: string | null;
          recording_enabled: boolean;
          sms_enabled: boolean;
          business_hours_enabled: boolean;
          business_hours_start: string;
          business_hours_end: string;
          business_timezone: string;
          business_days: number[];
          after_hours_message: string;
          updated_at: string;
        };
        Insert: {
          business_id: string;
          enabled?: boolean;
          provider?: string;
          phone_number?: string | null;
          outbound_enabled?: boolean;
          inbound_enabled?: boolean;
          callback_after_order?: boolean;
          callback_delay_minutes?: number;
          outbound_script?: string;
          inbound_greeting?: string;
          retell_agent_id?: string | null;
          vapi_assistant_id?: string | null;
          twilio_phone_sid?: string | null;
          ai_enabled?: boolean;
          voice_language?: string;
          voice_system_prompt?: string | null;
          recording_enabled?: boolean;
          sms_enabled?: boolean;
          business_hours_enabled?: boolean;
          business_hours_start?: string;
          business_hours_end?: string;
          business_timezone?: string;
          business_days?: number[];
          after_hours_message?: string;
          updated_at?: string;
        };
        Update: {
          business_id?: string;
          enabled?: boolean;
          provider?: string;
          phone_number?: string | null;
          outbound_enabled?: boolean;
          inbound_enabled?: boolean;
          callback_after_order?: boolean;
          callback_delay_minutes?: number;
          outbound_script?: string;
          inbound_greeting?: string;
          retell_agent_id?: string | null;
          vapi_assistant_id?: string | null;
          twilio_phone_sid?: string | null;
          ai_enabled?: boolean;
          voice_language?: string;
          voice_system_prompt?: string | null;
          recording_enabled?: boolean;
          sms_enabled?: boolean;
          business_hours_enabled?: boolean;
          business_hours_start?: string;
          business_hours_end?: string;
          business_timezone?: string;
          business_days?: number[];
          after_hours_message?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voice_agent_config_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_call_sessions: {
        Row: {
          id: string;
          business_id: string;
          call_sid: string;
          direction: string;
          turns: unknown;
          turn_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          call_sid: string;
          direction: string;
          turns?: unknown;
          turn_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          call_sid?: string;
          direction?: string;
          turns?: unknown;
          turn_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voice_call_sessions_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_call_logs: {
        Row: {
          id: string;
          business_id: string;
          contact_id: string | null;
          call_mode: string;
          operator_user_id: string | null;
          direction: string;
          phone_number: string;
          status: string;
          provider: string;
          external_call_id: string | null;
          trigger_reason: string | null;
          created_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          ai_handled: boolean;
          recording_url: string | null;
          recording_sid: string | null;
          conversation_id: string | null;
          handoff_at: string | null;
          human_handled: boolean;
          custom_prompt: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          contact_id?: string | null;
          call_mode?: string;
          operator_user_id?: string | null;
          direction: string;
          phone_number: string;
          status?: string;
          provider: string;
          external_call_id?: string | null;
          trigger_reason?: string | null;
          created_at?: string;
          ended_at?: string | null;
          duration_seconds?: number | null;
          ai_handled?: boolean;
          recording_url?: string | null;
          recording_sid?: string | null;
          conversation_id?: string | null;
          handoff_at?: string | null;
          human_handled?: boolean;
          custom_prompt?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          contact_id?: string | null;
          call_mode?: string;
          operator_user_id?: string | null;
          direction?: string;
          phone_number?: string;
          status?: string;
          provider?: string;
          external_call_id?: string | null;
          trigger_reason?: string | null;
          created_at?: string;
          ended_at?: string | null;
          duration_seconds?: number | null;
          ai_handled?: boolean;
          recording_url?: string | null;
          recording_sid?: string | null;
          conversation_id?: string | null;
          handoff_at?: string | null;
          human_handled?: boolean;
          custom_prompt?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "voice_call_logs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_call_logs_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_call_logs_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_call_logs_operator_user_id_fkey";
            columns: ["operator_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_call_events: {
        Row: {
          id: string;
          business_id: string;
          call_log_id: string | null;
          call_sid: string | null;
          event_type: string;
          actor_type: string;
          actor_user_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          call_log_id?: string | null;
          call_sid?: string | null;
          event_type: string;
          actor_type?: string;
          actor_user_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          call_log_id?: string | null;
          call_sid?: string | null;
          event_type?: string;
          actor_type?: string;
          actor_user_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voice_call_events_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_call_events_call_log_id_fkey";
            columns: ["call_log_id"];
            isOneToOne: false;
            referencedRelation: "voice_call_logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_call_events_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_post_call_jobs: {
        Row: {
          id: string;
          business_id: string;
          call_log_id: string;
          job_type: string;
          status: string;
          attempt_count: number;
          max_attempts: number;
          next_attempt_at: string;
          processing_started_at: string | null;
          processed_at: string | null;
          last_error: string | null;
          payload: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          call_log_id: string;
          job_type: string;
          status?: string;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          processing_started_at?: string | null;
          processed_at?: string | null;
          last_error?: string | null;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          call_log_id?: string;
          job_type?: string;
          status?: string;
          attempt_count?: number;
          max_attempts?: number;
          next_attempt_at?: string;
          processing_started_at?: string | null;
          processed_at?: string | null;
          last_error?: string | null;
          payload?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voice_post_call_jobs_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_post_call_jobs_call_log_id_fkey";
            columns: ["call_log_id"];
            isOneToOne: false;
            referencedRelation: "voice_call_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_call_queue: {
        Row: {
          id: string;
          business_id: string;
          contact_id: string | null;
          phone_number: string;
          trigger_reason: string;
          execute_at: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          contact_id?: string | null;
          phone_number: string;
          trigger_reason?: string;
          execute_at: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          contact_id?: string | null;
          phone_number?: string;
          trigger_reason?: string;
          execute_at?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "voice_call_queue_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "voice_call_queue_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics: {
        Row: {
          id: string;
          business_id: string;
          total_messages: number;
          total_contacts: number;
          ai_replies: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          total_messages?: number;
          total_contacts?: number;
          ai_replies?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          total_messages?: number;
          total_contacts?: number;
          ai_replies?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: true;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      user_owns_business: {
        Args: {
          business_uuid: string;
        };
        Returns: boolean;
      };
      increment_platform_prompt_usage: {
        Args: {
          p_prompt_key: string;
          p_version: number;
        };
        Returns: undefined;
      };
      claim_inbound_webhook_jobs: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["inbound_webhook_queue"]["Row"][];
      };
      claim_ai_reply_jobs: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["ai_reply_jobs"]["Row"][];
      };
      claim_ai_orchestration_jobs: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["ai_orchestration_jobs"]["Row"][];
      };
      claim_follow_up_jobs: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["follow_up_jobs"]["Row"][];
      };
      claim_event_reminder_jobs: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["event_reminder_jobs"]["Row"][];
      };
      claim_voice_post_call_jobs: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["voice_post_call_jobs"]["Row"][];
      };
      match_knowledge_by_embedding: {
        Args: {
          p_business_id: string;
          p_query_embedding: string;
          p_match_count?: number;
        };
        Returns: {
          id: string;
          title: string;
          content: string;
          category: string;
          similarity: number;
        }[];
      };
      upsert_ai_reply_job: {
        Args: {
          p_business_id: string;
          p_conversation_id: string;
          p_channel: Database["public"]["Enums"]["messaging_channel"];
          p_message: string;
        };
        Returns: string;
      };
      claim_message_delivery_jobs: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["message_deliveries"]["Row"][];
      };
      claim_message_delivery_job: {
        Args: {
          p_message_id: string;
        };
        Returns: Database["public"]["Tables"]["message_deliveries"]["Row"][];
      };
      claim_inbound_media_hydration_jobs: {
        Args: {
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["message_attachments"]["Row"][];
      };
      claim_inbound_media_hydration_job: {
        Args: {
          p_message_id: string;
        };
        Returns: Database["public"]["Tables"]["message_attachments"]["Row"][];
      };
      list_inbox_conversations: {
        Args: {
          p_business_id: string;
          p_user_id?: string | null;
          p_channel?: Database["public"]["Enums"]["messaging_channel"] | null;
          p_search?: string | null;
          p_view?: string;
          p_filter?: string;
          p_sort?: string;
          p_limit?: number;
          p_offset?: number;
          p_include_total_count?: boolean;
        };
        Returns: {
          id: string;
          channel: Database["public"]["Enums"]["messaging_channel"];
          status: Database["public"]["Enums"]["conversation_status"];
          updated_at: string;
          last_read_at: string | null;
          unread_count: number;
          last_message_preview: string | null;
          last_message_at: string | null;
          last_message_sender_type: Database["public"]["Enums"]["message_sender_type"];
          last_message_ai_generated: boolean;
          last_client_message_at: string | null;
          contact_id: string;
          contact_name: string;
          contact_phone: string;
          contact_lead_score: number | null;
          contact_is_favorite: boolean;
          contact_avatar_url: string | null;
          total_count: number | null;
        }[];
      };
      inbox_search_tsquery: {
        Args: {
          p_search: string;
        };
        Returns: unknown;
      };
      resolve_inbound_message_context: {
        Args: {
          p_business_id: string;
          p_channel: Database["public"]["Enums"]["messaging_channel"];
          p_contact_name: string;
          p_contact_phone: string;
          p_external_id: string;
          p_display_label?: string | null;
        };
        Returns: {
          contact_id: string;
          conversation_id: string;
          created_contact: boolean;
        }[];
      };
      insert_inbound_channel_message: {
        Args: {
          p_conversation_id: string;
          p_channel: Database["public"]["Enums"]["messaging_channel"];
          p_sender_type: Database["public"]["Enums"]["message_sender_type"];
          p_content: string;
          p_external_message_id?: string | null;
          p_message_preview?: string | null;
          p_email_subject?: string | null;
          p_sent_at?: string | null;
        };
        Returns: {
          id: string;
          conversation_id: string;
          channel: Database["public"]["Enums"]["messaging_channel"];
          sender_type: Database["public"]["Enums"]["message_sender_type"];
          content: string;
          email_subject: string | null;
          ai_generated: boolean;
          created_at: string;
          sent_at: string;
          external_message_id: string | null;
          is_duplicate: boolean;
        }[];
      };
    };
    Enums: {
      auth_provider: AuthProvider;
      knowledge_category: KnowledgeCategory;
      whatsapp_status: WhatsappStatus;
      instagram_status: InstagramStatus;
      telegram_status: TelegramStatus;
      telegram_user_status: TelegramUserStatus;
      whatsapp_web_status: WhatsAppWebStatus;
      email_connection_status: EmailConnectionStatus;
      google_calendar_status: GoogleCalendarStatus;
      twilio_connection_status: TwilioConnectionStatus;
      twilio_auth_mode: TwilioAuthMode;
      website_form_status: WebsiteFormStatus;
      website_form_follow_up: WebsiteFormFollowUp;
      website_knowledge_sync_status: WebsiteKnowledgeSyncStatus;
      messaging_channel: MessagingChannel;
      conversation_status: ConversationStatus;
      message_sender_type: MessageSenderType;
      message_delivery_status: MessageDeliveryStatus;
      message_attachment_kind: MessageAttachmentKind;
      message_attachment_status: MessageAttachmentStatus;
      webhook_queue_status: WebhookQueueStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type User = Database["public"]["Tables"]["users"]["Row"];
export type Business = Database["public"]["Tables"]["businesses"]["Row"];
export type KnowledgeEntry = Database["public"]["Tables"]["knowledge_base"]["Row"];
export type WhatsappConnection =
  Database["public"]["Tables"]["whatsapp_connections"]["Row"];
export type InstagramConnection =
  Database["public"]["Tables"]["instagram_connections"]["Row"];
export type TelegramConnection =
  Database["public"]["Tables"]["telegram_connections"]["Row"];
export type EmailConnection =
  Database["public"]["Tables"]["email_connections"]["Row"];
export type GoogleCalendarConnection =
  Database["public"]["Tables"]["google_calendar_connections"]["Row"];
export type TwilioConnection =
  Database["public"]["Tables"]["twilio_connections"]["Row"];
export type WebsiteFormConnection =
  Database["public"]["Tables"]["website_form_connections"]["Row"];
export type WebsiteKnowledgeSync =
  Database["public"]["Tables"]["website_knowledge_syncs"]["Row"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type AiSettings = Database["public"]["Tables"]["ai_settings"]["Row"];
export type Analytics = Database["public"]["Tables"]["analytics"]["Row"];

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
