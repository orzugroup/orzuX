"use client";

import { useState } from "react";
import { PhoneCallIcon } from "lucide-react";

import { InternetPhoneStaffCallPanel } from "@/components/internet-phone/InternetPhoneStaffCallPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { INTERNET_PHONE_MESSAGES } from "@/features/internet-phone/constants";
import { useInternetPhoneCallsRealtime } from "@/hooks/use-internet-phone-calls-realtime";
import type { InternetPhoneLiveCall } from "@/types/internet-phone.types";

type InternetPhoneLiveCallsPanelProps = {
  businessId: string | null;
  enabled?: boolean;
};

export function InternetPhoneLiveCallsPanel({
  businessId,
  enabled = true,
}: InternetPhoneLiveCallsPanelProps) {
  const [calls, setCalls] = useState<InternetPhoneLiveCall[]>([]);

  useInternetPhoneCallsRealtime({
    enabled: enabled && Boolean(businessId),
    businessId,
    onCallsChange: setCalls,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneCallIcon className="size-4" />
          {INTERNET_PHONE_MESSAGES.liveCallsTitle}
        </CardTitle>
        <CardDescription>
          Listen in or take over browser calls. AI mutes when you join as staff.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {INTERNET_PHONE_MESSAGES.liveCallsEmpty}
          </p>
        ) : (
          calls.map((call) => (
            <InternetPhoneStaffCallPanel
              key={call.id}
              call={call}
              onEnded={() =>
                setCalls((current) => current.filter((item) => item.id !== call.id))
              }
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
