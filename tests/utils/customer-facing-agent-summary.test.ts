import { describe, expect, it } from "vitest";

import {
  buildBookingFailureFollowUp,
  isSoftDataCollectionBookingBlock,
  shouldSendCustomerActionFollowUp,
} from "@/utils/customer-facing-agent-summary";

describe("customer-facing booking failures", () => {
  it("detects CRM data-collection soft block labels", () => {
    expect(
      isSoftDataCollectionBookingBlock(
        "Booking not confirmed: waiting for required customer data",
      ),
    ).toBe(true);
  });

  it("does not send follow-up for soft data-collection booking blocks", () => {
    expect(
      shouldSendCustomerActionFollowUp({
        actionsApplied: [
          "Booking not confirmed: waiting for required customer data",
        ],
      }),
    ).toBe(false);
  });

  it("localizes real booking failures for Russian", () => {
    const text = buildBookingFailureFollowUp({
      language: "Russian",
      actionsApplied: ["Booking not confirmed: slot no longer available"],
    });

    expect(text).toContain("Пока не получилось подтвердить бронь");
    expect(text).toContain("slot no longer available");
  });

  it("returns null follow-up for soft data-collection block", () => {
    expect(
      buildBookingFailureFollowUp({
        language: "Russian",
        actionsApplied: [
          "Booking not confirmed: waiting for required customer data",
        ],
      }),
    ).toBeNull();
  });
});
