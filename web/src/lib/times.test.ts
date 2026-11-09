import { describe, expect, it } from "vitest";
import { dateWithYear, dayAndTime, dayOrToday, pausedSince, when } from "./times";

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

  it("write every date one way, three letters for the month, even September (decision 0215)", () => {
    expect(when(at(new Date(2026, 8, 29, 9, 0)), now)).toBe("29 Sep");
    expect(dayOrToday(at(new Date(2026, 9, 23, 7, 0)), now)).toBe("today");
    expect(dayOrToday(at(new Date(2026, 10, 4, 9, 0)), now)).toBe("4 Nov");
    expect(dayOrToday(at(new Date(2025, 2, 14, 9, 0)), now)).toBe("14 Mar 2025");
    expect(dateWithYear(new Date(2026, 9, 27))).toBe("27 Oct 2026");
    expect(dayAndTime(at(new Date(2026, 8, 29, 14, 5)))).toBe("29 Sep, 14:05");
  });
});
