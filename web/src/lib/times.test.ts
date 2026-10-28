import { describe, expect, it } from "vitest";
import { dayHeading, pausedSince, when } from "./times";

describe("article times", () => {
  const now = new Date(2026, 9, 23, 18, 0);
  const at = (date: Date) => date.getTime() / 1000;

  it("show the time for today, the day for this year, and the year before that", () => {
    expect(when(at(new Date(2026, 9, 23, 14, 5)), now)).toBe("14:05");
    expect(when(at(new Date(2026, 9, 22, 23, 59)), now)).toBe("22 Oct");
    expect(when(at(new Date(2026, 0, 1, 9, 0)), now)).toBe("1 Jan");
    expect(when(at(new Date(2025, 9, 23, 14, 5)), now)).toBe("23 Oct 2025");
  });

  it("say when a paused feed was paused", () => {
    expect(pausedSince(at(new Date(2026, 9, 23, 9, 0)), now)).toBe("Paused today.");
    expect(pausedSince(at(new Date(2026, 9, 20, 9, 0)), now)).toBe("Paused on 20 Oct.");
    expect(pausedSince(at(new Date(2025, 11, 30, 9, 0)), now)).toBe("Paused on 30 Dec 2025.");
  });
});

describe("Recently read's day headings", () => {
  // Tuesday 27 October 2026, mid-afternoon, on this computer's clock.
  const now = new Date(2026, 9, 27, 15, 30);
  const at = (year: number, month: number, day: number, hour = 12) => new Date(year, month, day, hour).getTime() / 1000;
  it("say Today and Yesterday, then the weekday for the last week, then the date", () => {
    expect(dayHeading(at(2026, 9, 27, 0), now)).toBe("Today");
    expect(dayHeading(at(2026, 9, 26, 23), now)).toBe("Yesterday");
    expect(dayHeading(at(2026, 9, 26, 0), now)).toBe("Yesterday");
    expect(dayHeading(at(2026, 9, 25), now)).toBe("Sunday");
    expect(dayHeading(at(2026, 9, 21), now)).toBe("Wednesday");
    expect(dayHeading(at(2026, 9, 20), now)).toBe("20 October");
    expect(dayHeading(at(2025, 11, 31), now)).toBe("31 December 2025");
  });
  it("count a time a moment ahead of this device's clock as today", () => {
    expect(dayHeading(now.getTime() / 1000 + 60, now)).toBe("Today");
  });
});
