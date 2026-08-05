import { describe, expect, it } from "vitest";

import {
  hasBookingConfirmedAction,
  isBookingRelatedTurn,
  looksLikeFalseBookingConfirmation,
} from "@/lib/ai/booking-message-context";
import { normalizeOrchestratorPayload } from "@/lib/ai/normalize-orchestrator-response";
import { orchestratorResponseSchema } from "@/types/ai-orchestrator.types";

describe("isBookingRelatedTurn", () => {
  it("detects slot selection after assistant offered times", () => {
    const history = [
      {
        role: "assistant" as const,
        content:
          "Доступны слоты: 10:00, 12:00, 14:00. Какое время вам подходит?",
      },
    ];

    expect(isBookingRelatedTurn("Мне подходит 14", history)).toBe(true);
    expect(isBookingRelatedTurn("14:00", history)).toBe(true);
  });
});

describe("normalizeOrchestratorPayload", () => {
  it("accepts alias intent and strict contactUpdates", () => {
    const normalized = normalizeOrchestratorPayload({
      intent: "appointment",
      confidence: "0.9",
      managerAlert: "false",
      handoffConfirmed: false,
      contactUpdates: {
        name: "Anna",
        unknownField: "strip me",
      },
      actions: [
        {
          type: "create_calendar_event",
          summary: "Consultation",
          startDateTime: "2026-08-06T12:00:00.000Z",
          timeZone: "Europe/Berlin",
        },
      ],
    });

    const validated = orchestratorResponseSchema.safeParse(normalized);

    expect(validated.success).toBe(true);

    if (validated.success) {
      expect(validated.data.intent).toBe("booking");
      expect(validated.data.actions[0]?.type).toBe("create_calendar_event");
      expect(
        validated.data.actions[0]?.type === "create_calendar_event" &&
          validated.data.actions[0].endDateTime,
      ).toBeTruthy();
    }
  });
});

describe("booking confirmation guards", () => {
  it("flags false booking claims", () => {
    expect(
      looksLikeFalseBookingConfirmation(
        "Отлично! Я записал вас на завтра в 14:00. Ждем вас!",
      ),
    ).toBe(true);
    expect(hasBookingConfirmedAction(["Booking confirmed — Tue 14:00"])).toBe(
      true,
    );
  });
});
