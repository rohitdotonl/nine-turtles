import { describe, expect, it } from "vitest";
import { brokenSince, found, headline, reason, refusalMessage, type Sick } from "./health";

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
  ...change,
});

describe("the words for who isn't working", () => {
  it("leads with since when nothing has come through", () => {
    const now = new Date(2026, 10, 6, 12, 0);
    const at = (...parts: [number, number, number, number]) => new Date(...parts).getTime() / 1000;
    expect(headline(sick({ failingSince: at(2026, 10, 1, 9) }), now)).toBe("Nothing has come through since 1 Nov");
    expect(
      headline(sick({ problem: "not-found", failingSince: at(2026, 9, 1, 9), missingSince: at(2026, 9, 20, 9), state: "dead" }), now),
    ).toBe("Nothing has come through since 20 Oct");
    expect(headline(sick({ failingSince: at(2026, 10, 6, 8) }), now)).toBe("Nothing has come through since earlier today");
    expect(headline(sick({ state: "working" }), now)).toBe("Working again");
  });

  it("explains every problem in plain words, never with a code", () => {
    const problems = ["not-found", "unreachable", "blocked", "not-a-feed", "too-big", "slow-down", "not-allowed", "not-an-address"];
    for (const problem of [...problems, "answered-403", "answered-500", "answered-418", null]) {
      const words = reason(problem);
      expect(words).toMatch(/^[A-Z].*\.$/);
      expect(words).not.toMatch(/\d{3}|-/);
    }
    expect(reason("answered-403")).toBe("The site refuses to share this feed.");
    // A guard against bots is named as such, and the reader learns only the site can fix it (decision 0258).
    expect(reason("blocked")).toMatch(/guard against bots .* Only the site can let it in\./);
    expect(refusalMessage({ error: "blocked" }, "find")).toMatch(/guard against bots/);
  });

  it("says YouTube isn't sending, instead of that a YouTube feed may have moved (decision 0272)", () => {
    const channel = "https://www.youtube.com/feeds/videos.xml?channel_id=UCI9w0pAIlXrQuSYA79x0F3w";
    const uploads = "https://www.youtube.com/feeds/videos.xml?playlist_id=UUI9w0pAIlXrQuSYA79x0F3w";
    for (const url of [channel, uploads])
      for (const problem of ["not-found", "unreachable", "answered-500"])
        expect(reason(problem, url)).toMatch(/^YouTube isn't sending this channel's videos to nine turtles at the moment\./);
    // Its other problems, and other sites, keep their own words.
    expect(reason("blocked", channel)).toMatch(/guard against bots/);
    expect(reason("answered-403", channel)).toBe("The site refuses to share this feed.");
    expect(reason("not-found", "https://blog.example/feed")).toMatch(/It may have moved\./);
    expect(reason("not-found", "https://www.youtube.com.example/feeds/videos.xml?channel_id=x")).toMatch(/It may have moved\./);
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
