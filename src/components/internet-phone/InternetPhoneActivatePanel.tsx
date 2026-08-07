"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  DownloadIcon,
  Loader2Icon,
  PhoneCallIcon,
  QrCodeIcon,
} from "lucide-react";
import { toast } from "sonner";

import { IntegrationCopyField } from "@/components/integrations/IntegrationCopyField";
import { IntegrationDangerZone } from "@/components/integrations/IntegrationDangerZone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { connectInternetPhoneAction } from "@/features/internet-phone/actions/connect";
import { disconnectInternetPhoneAction } from "@/features/internet-phone/actions/disconnect";
import { INTERNET_PHONE_MESSAGES } from "@/features/internet-phone/constants";
import type {
  InternetPhoneConnectConfig,
  InternetPhoneConnectionData,
} from "@/types/internet-phone.types";

type InternetPhoneActivatePanelProps = {
  connection: InternetPhoneConnectionData | null;
  hasBusiness: boolean;
  config: InternetPhoneConnectConfig;
  embeddedInHub?: boolean;
};

export function InternetPhoneActivatePanel({
  connection,
  hasBusiness,
  config,
  embeddedInHub = false,
}: InternetPhoneActivatePanelProps) {
  const [localConnection, setLocalConnection] = useState(connection);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const connected = localConnection?.status === "connected";

  const loadQr = useCallback(async () => {
    if (!connected) {
      setQrDataUrl(null);
      return;
    }

    try {
      const response = await fetch("/api/internet-phone/qr", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as { dataUrl?: string };
      if (body.dataUrl) setQrDataUrl(body.dataUrl);
    } catch {
      // Best-effort preview.
    }
  }, [connected]);

  useEffect(() => {
    setLocalConnection(connection);
  }, [connection]);

  useEffect(() => {
    void loadQr();
  }, [loadQr]);

  const onConnect = () => {
    startTransition(async () => {
      const result = await connectInternetPhoneAction();
      if (!result.success) {
        toast.error(result.error.message);
        return;
      }
      setLocalConnection(result.connection);
      toast.success(INTERNET_PHONE_MESSAGES.connectSuccess);
    });
  };

  const onDisconnect = async () => {
    const result = await disconnectInternetPhoneAction();
    if (!result.success) {
      return {
        success: false as const,
        message: result.error.message,
      };
    }
    setLocalConnection(result.connection);
    setQrDataUrl(null);
    return { success: true as const };
  };

  return (
    <div className={embeddedInHub ? "space-y-6" : "mx-auto max-w-3xl space-y-6"}>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{INTERNET_PHONE_MESSAGES.pageTitle}</CardTitle>
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? "Connected" : "Not connected"}
            </Badge>
          </div>
          <CardDescription>
            {INTERNET_PHONE_MESSAGES.pageDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasBusiness ? (
            <p className="text-sm text-muted-foreground">
              {INTERNET_PHONE_MESSAGES.noBusinessDescription}
            </p>
          ) : !config.isConfigured ? (
            <p className="text-sm text-muted-foreground">
              {INTERNET_PHONE_MESSAGES.notConfigured}
            </p>
          ) : !connected ? (
            <Button type="button" onClick={onConnect} disabled={isPending}>
              {isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <PhoneCallIcon className="size-4" />
              )}
              Connect Internet Phone
            </Button>
          ) : (
            <div className="space-y-4">
              <IntegrationCopyField
                label={INTERNET_PHONE_MESSAGES.copyLink}
                value={localConnection.publicUrl}
              />

              <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/20 p-4">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrDataUrl}
                      alt="Internet Phone QR code"
                      className="size-48 rounded-md bg-white p-2"
                    />
                  ) : (
                    <div className="flex size-48 items-center justify-center rounded-md border border-dashed">
                      <QrCodeIcon className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-center text-xs text-muted-foreground">
                    Customers scan to open your browser phone
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Preview the live page, share the link, or download a printable
                    A5 PDF with the QR code for your desk or storefront.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                      <a
                        href={localConnection.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open live preview
                      </a>
                    </Button>
                    <Button asChild variant="secondary">
                      <a href="/api/internet-phone/pdf">
                        <DownloadIcon className="size-4" />
                        {INTERNET_PHONE_MESSAGES.downloadPdf}
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {connected ? (
        <IntegrationDangerZone
          resourceLabel="Internet Phone"
          successMessage={INTERNET_PHONE_MESSAGES.disconnectSuccess}
          onDisconnect={onDisconnect}
        />
      ) : null}
    </div>
  );
}
