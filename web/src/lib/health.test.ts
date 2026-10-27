import { describe, expect, it } from "vitest";
import { forHowLong, headline, lastWorked, reason, refusalMessage, type Sick } from "./health";

const DAY = 24 * 60 * 60;
const NOW = 1_790_000_000;

const sick = (change: Partial<Sick>): Sick => ({
  id: 1,
  title: "A blog",
  url: "https://blog.example/feed",
  problem: "unreachable",
  failingSince: NOW - 3 * DAY,
  missingSince: null,
  fetchedAt: NOW - 3 * DAY,
  state: "trouble",
  frequency: null,
  ...change,
});

describe("the feed health page's words", () => {
  it("says how long in days, weeks or months", () => {
    expect(forHowLong(3600)).toBe("for less than a day");
    expect(forHowLong(DAY)).toBe("for a day");
    expect(forHowLong(8 * DAY)).toBe("for 8 days");
    expect(forHowLong(21 * DAY)).toBe("for 3 weeks");
    expect(forHowLong(90 * DAY)).toBe("for 3 months");
  });

  it("leads with how long it hasn't worked, or hasn't been found", () => {
    expect(headline(sick({ failingSince: NOW - 21 * DAY }), NOW)).toBe("Hasn't worked for 3 weeks");
    expect(headline(sick({ problem: "not-found", missingSince: NOW - 8 * DAY, state: "dead" }), NOW)).toBe(
      "Not found for 8 days",
    );
    expect(headline(sick({ state: "working" }), NOW)).toBe("Working again");
  });

  it("explains every problem in plain words, never with a code", () => {
    const problems = ["not-found", "unreachable", "not-a-feed", "too-big", "slow-down", "not-allowed", "not-an-address"];
    for (const problem of [...problems, "answered-403", "answered-500", "answered-418", null]) {
      const words = reason(problem);
      expect(words).toMatch(/^[A-Z].*\.$/);
      expect(words).not.toMatch(/\d{3}|-/);
    }
    expect(reason("answered-403")).toBe("The site refuses to share this feed.");
  });

  it("says when it last worked", () => {
    const now = new Date(2026, 9, 25, 12, 0);
    const today = new Date(2026, 9, 25, 9, 0).getTime() / 1000;
    const earlier = new Date(2026, 9, 3, 9, 0).getTime() / 1000;
    expect(lastWorked(sick({ fetchedAt: today }), now)).toBe("Last worked today");
    expect(lastWorked(sick({ fetchedAt: earlier }), now)).toBe("Last worked on 3 Oct");
    expect(lastWorked(sick({ fetchedAt: null }), now)).toBe("Hasn't worked since you added it");
  });

  it("says plainly why an action didn't work", () => {
    expect(refusalMessage({ error: "no-feed" }, "find")).toMatch(/doesn't name another feed/);
    expect(refusalMessage({ error: "no-feed" }, "move")).toBe("That address isn't a feed.");
    expect(refusalMessage({ error: "already" }, "move")).toBe("You already follow that feed.");
  });
});
