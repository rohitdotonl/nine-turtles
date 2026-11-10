import { describe, expect, it } from "vitest";
import { date, dayAndTime, dayOrToday, exactly, nothingNewSince, pausedSince, until, when } from "./times";

describe("article times", () => {
  const now = new Date(2026, 9, 23, 18, 0);
  const at = (date: Date) => date.getTime() / 1000;

  it("say the day in words: today, yesterday, the weekday this week, then the date (decision 0218)", () => {
    expect(when(at(new Date(2026, 9, 23, 0, 0)), now)).toBe("Today");
    expect(when(at(new Date(2026, 9, 23, 14, 5)), now)).toBe("Today");
    expect(when(at(new Date(2026, 9, 22, 23, 59)), now)).toBe("Yesterday");
    expect(when(at(new Date(2026, 9, 21, 9, 0)), now)).toBe("Wednesday");
    expect(when(at(new Date(2026, 9, 17, 9, 0)), now)).toBe("Saturday");
    expect(when(at(new Date(2026, 9, 16, 23, 59)), now)).toBe("16 Oct");
    expect(when(at(new Date(2026, 0, 1, 9, 0)), now)).toBe("1 Jan");
    expect(when(at(new Date(2025, 9, 23, 14, 5)), now)).toBe("23 Oct 2025");
  });

  it("count days by the calendar, not by 24-hour stretches", () => {
    const afterChange = new Date(2026, 10, 2, 0, 30);
    expect(when(at(new Date(2026, 9, 27, 9, 0)), afterChange)).toBe("Tuesday");
    expect(when(at(new Date(2026, 10, 1, 23, 30)), afterChange)).toBe("Yesterday");
  });

  it("call a publisher's date a little in the future today", () => {
    expect(when(at(new Date(2026, 9, 24, 9, 0)), now)).toBe("Today");
  });

  it("keep the exact time for the tooltip", () => {
    expect(exactly(at(new Date(2026, 10, 8, 6, 0)))).toBe("Sunday, 8 November 2026 at 06:00");
  });

  it("put a time later today as a time, for a sentence", () => {
    expect(until(at(new Date(2026, 9, 23, 20, 30)), now)).toBe("20:30");
    expect(until(at(new Date(2026, 9, 25, 9, 0)), now)).toBe("25 Oct");
  });

  it("say when a paused feed was paused", () => {
    expect(pausedSince(at(new Date(2026, 9, 23, 9, 0)), now)).toBe("Paused today.");
    expect(pausedSince(at(new Date(2026, 9, 20, 9, 0)), now)).toBe("Paused on 20 Oct.");
    expect(pausedSince(at(new Date(2025, 11, 30, 9, 0)), now)).toBe("Paused on 30 Dec 2025.");
  });

  it("write every date one way, three letters for the month, even September (decision 0215)", () => {
    expect(when(at(new Date(2026, 8, 29, 9, 0)), now)).toBe("29 Sep");
    expect(dayOrToday(at(new Date(2026, 9, 23, 7, 0)), now)).toBe("today");
    expect(dayOrToday(at(new Date(2026, 10, 4, 9, 0)), now)).toBe("4 Nov");
    expect(dayOrToday(at(new Date(2025, 2, 14, 9, 0)), now)).toBe("14 Mar 2025");
    expect(date(at(new Date(2026, 9, 27, 9, 0)))).toBe("27 Oct 2026");
    expect(dayAndTime(at(new Date(2026, 8, 29, 14, 5)))).toBe("29 Sep, 14:05");
  });
});

describe("refresh with nothing new (decision 0229)", () => {
  const now = new Date(2026, 9, 23, 18, 0);
  it("says when the list last loaded: the time today, else the day", () => {
    expect(nothingNewSince(new Date(2026, 9, 23, 14, 5), now)).toBe("Nothing new has arrived since 14:05.");
    expect(nothingNewSince(new Date(2026, 9, 3, 9, 0), now)).toBe("Nothing new has arrived since 3 Oct.");
  });
});
