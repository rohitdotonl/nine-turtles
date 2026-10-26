import { describe as group, expect, it } from "vitest";
import { canSubscribe, describe, label, refusal, toPlanStatus, toStanding } from "./plan";

group("the reader's plan", () => {
  it("reads the server's answer, and anything unknown as ended", () => {
    expect(toPlanStatus({ on: false })).toEqual({ on: false });
    expect(
      toPlanStatus({
        on: true,
        test_mode: true,
        plan: { standing: "trial", ends_at: 100 },
        prices: { monthly: "$5 a month", yearly: null },
        can_manage: false,
      }),
    ).toEqual({
      on: true,
      testMode: true,
      plan: { standing: "trial", endsAt: 100 },
      prices: { monthly: "$5 a month", yearly: null },
      canManage: false,
    });
    expect(toStanding({ standing: "paid", until: 9, renews_at: 8, ending: false, period: "yearly" })).toEqual({
      standing: "paid",
      until: 9,
      renewsAt: 8,
      ending: false,
      period: "yearly",
    });
    expect(toStanding({ standing: "something new" })).toEqual({ standing: "ended" });
    expect(toStanding(null)).toEqual({ standing: "ended" });
  });

  it("says where the reader stands in plain words", () => {
    // 26 November 2026, midday UTC.
    const day = Date.UTC(2026, 10, 26, 12) / 1000;
    expect(describe({ standing: "trial", endsAt: day }).detail).toBe("Your trial ends on 26 November 2026.");
    expect(describe({ standing: "paid", until: day, renewsAt: day, ending: false, period: "monthly" })).toEqual({
      title: "Monthly plan",
      detail: "Renews on 26 November 2026.",
    });
    expect(describe({ standing: "paid", until: day, renewsAt: null, ending: true, period: null }).detail).toBe(
      "Cancelled. It lasts until 26 November 2026.",
    );
    expect(describe({ standing: "on-hold", until: day }).title).toBe("Your last payment didn't go through");
    expect(describe({ standing: "ended" }).title).toBe("Your free trial or plan has ended");
  });

  it("offers a plan only when there's none renewing", () => {
    expect(canSubscribe({ standing: "trial", endsAt: 1 })).toBe(true);
    expect(canSubscribe({ standing: "ended" })).toBe(true);
    expect(canSubscribe({ standing: "free" })).toBe(false);
    expect(canSubscribe({ standing: "on-hold", until: 1 })).toBe(false);
    expect(canSubscribe({ standing: "paid", until: 1, renewsAt: 1, ending: false, period: null })).toBe(false);
    expect(canSubscribe({ standing: "paid", until: 1, renewsAt: null, ending: true, period: null })).toBe(true);
  });

  it("names the plan in a few words for the owner, and says why a door stayed shut", () => {
    expect(label({ standing: "trial", endsAt: 1 })).toBe("Free trial");
    expect(label({ standing: "paid", until: 1, renewsAt: 1, ending: false, period: "yearly" })).toBe("Yearly plan");
    expect(label({ standing: "paid", until: 1, renewsAt: null, ending: true, period: "monthly" })).toBe("Plan cancelled");
    expect(label({ standing: "ended" })).toBe("Plan ended");
    expect(refusal("no-email")).toBe("Your account needs an email before you can choose a plan.");
    expect(refusal("something else")).toBe("Payments can't be reached just now. Try again in a moment.");
  });
});
