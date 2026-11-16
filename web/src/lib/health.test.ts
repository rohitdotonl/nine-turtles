import { describe, expect, it } from "vitest";
import { brokenSince, failingDay, found, reason, refusalMessage, youTubeRefusing, type Sick } from "./health";

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
  youtube: false,
  ...change,
});

describe("the words for who isn't working", () => {
  it("shows the day nothing has come through since", () => {
    const now = new Date(2026, 10, 6, 12, 0);
    const at = (...parts: [number, number, number, number]) => new Date(...parts).getTime() / 1000;
    expect(failingDay(sick({ failingSince: at(2026, 10, 1, 9) }), now)).toBe("1 Nov");
    // A feed that's gone counts from when it went, not from its first failure.
    expect(failingDay(sick({ problem: "not-found", failingSince: at(2026, 9, 1, 9), missingSince: at(2026, 9, 20, 9), state: "dead" }), now)).toBe("20 Oct");
    expect(failingDay(sick({ failingSince: at(2026, 10, 6, 8) }), now)).toBe("Today");
    expect(failingDay(sick({ failingSince: at(2025, 11, 3, 8) }), now)).toBe("3 Dec 2025");
    expect(failingDay(sick({ failingSince: null }), now)).toBe("");
  });

  it("explains every problem in a few plain words, never with a code", () => {
    const problems = ["not-found", "unreachable", "blocked", "not-a-feed", "too-big", "slow-down", "not-allowed", "not-an-address"];
    for (const problem of [...problems, "answered-403", "answered-500", "answered-418", null]) {
      const words = reason(sick({ problem }));
      expect(words).toMatch(/^[A-Z][^.]*[a-z]$/);
      expect(words).not.toMatch(/\d{3}|-/);
      expect(words.split(" ").length).toBeLessThanOrEqual(9);
    }
    expect(reason(sick({ problem: "not-found" }))).toBe("The feed isn't there any more");
    expect(reason(sick({ problem: "answered-403" }))).toBe("The site refuses to share the feed");
    // A guard against bots is named as such (decision 0258).
    expect(reason(sick({ problem: "blocked" }))).toMatch(/guard against bots/);
    expect(refusalMessage({ error: "blocked" }, "find")).toMatch(/guard against bots/);
  });

  it("says YouTube isn't sending, instead of that a YouTube feed may have gone (decision 0272)", () => {
    for (const problem of ["not-found", "unreachable", "answered-500"]) {
      expect(reason(sick({ youtube: true, problem }))).toBe("YouTube isn't sending these for now");
      expect(youTubeRefusing(sick({ youtube: true, problem }))).toBe(true);
    }
    // Its other problems, and other sites, keep their own words.
    expect(reason(sick({ youtube: true, problem: "blocked" }))).toMatch(/guard against bots/);
    expect(reason(sick({ youtube: true, problem: "answered-403" }))).toBe("The site refuses to share the feed");
    expect(youTubeRefusing(sick({ youtube: true, problem: "blocked" }))).toBe(false);
    expect(youTubeRefusing(sick({ problem: "not-found" }))).toBe(false);
  });

  it("says plainly why an action didn't work", () => {
    expect(refusalMessage({ error: "no-feed" }, "find")).toMatch(/doesn't name another feed/);
    expect(refusalMessage({ error: "no-feed" }, "move")).toBe("That address isn't a feed.");
    expect(refusalMessage({ error: "already" }, "move")).toBe("You already follow that feed.");
  });
});

describe("a failing feed's line and Find new address (decision 0106)", () => {
  it("says since when the feed hasn't worked, in words", () => {
    const now = new Date(2026, 9, 27, 12, 0);
    const at = (...parts: [number, number, number, number]) => new Date(...parts).getTime() / 1000;
    expect(brokenSince(at(2026, 9, 12, 9), now)).toBe("This feed hasn't worked since 12 Oct.");
    expect(brokenSince(at(2025, 11, 3, 9), now)).toBe("This feed hasn't worked since 3 Dec 2025.");
    expect(brokenSince(at(2026, 9, 27, 8), now)).toBe("This feed hasn't worked since earlier today.");
  });

  it("asks one plain question for one feed, offers a choice for several, and explains none", () => {
    const one = { title: "A blog", url: "https://blog.example/new.xml" };
    const two = { title: "Comments", url: "https://blog.example/comments.xml" };
    expect(found([one])).toEqual({ kind: "one", choice: one, said: "Use https://blog.example/new.xml instead?" });
    expect(found([one, two])).toMatchObject({ kind: "several", choices: [one, two] });
    expect(found([])).toMatchObject({ kind: "none", said: expect.stringMatching(/doesn't name another feed/) });
    expect(found({ error: "unreachable" })).toEqual({ kind: "none", said: "The site didn't answer. Try again later." });
  });
});
