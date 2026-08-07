"use client";

import { useEffect, useRef } from "react";

import { listInternetPhoneLiveCallsAction } from "@/features/internet-phone/actions/list-live-calls";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { waitForSupabaseRealtime } from "@/lib/supabase/realtime-auth";
import type { InternetPhoneLiveCall } from "@/types/internet-phone.types";

const POLL_INTERVAL_MS = 4000;

type UseInternetPhoneCallsRealtimeOptions = {
  enabled?: boolean;
  businessId?: string | null;
  onCallsChange: (calls: InternetPhoneLiveCall[]) => void;
};

export function useInternetPhoneCallsRealtime({
  enabled = true,
  businessId,
  onCallsChange,
}: UseInternetPhoneCallsRealtimeOptions): void {
  const onCallsChangeRef = useRef(onCallsChange);
  onCallsChangeRef.current = onCallsChange;

  useEffect(() => {
    if (!enabled || !businessId) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const refresh = async () => {
      const result = await listInternetPhoneLiveCallsAction();
      if (cancelled || !result.success) return;
      onCallsChangeRef.current(result.calls);
    };

    void refresh();
    pollTimer = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    const supabase = createClientIfConfigured();
    if (!supabase) {
      return () => {
        cancelled = true;
        if (pollTimer) clearInterval(pollTimer);
      };
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const ready = await waitForSupabaseRealtime(supabase);
      if (!ready || cancelled) return;

      channel = supabase
        .channel(`internet-phone-calls:${businessId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "internet_phone_calls",
            filter: `business_id=eq.${businessId}`,
          },
          () => {
            void refresh();
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [enabled, businessId]);
}
