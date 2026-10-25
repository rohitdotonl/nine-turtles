import { describe, expect, it } from "vitest";
import { folderNames, isQuiet, lastPostedWords, movedMessage, shown, unsubscribedMessage, type Tended } from "./tidy";

const DAY = 24 * 60 * 60;
const NOW = 1_790_000_000;

const feed = (change: Partial<Tended>): Tended => ({
  id: 1,
  title: "A blog",
  lastPosted: NOW - 3 * DAY,
  addedAt: NOW - 400 * DAY,
  folders: [],
  ...change,
});

describe("your feeds", () => {
  it("finds the feeds that have been quiet for 6 or 12 months", () => {
    const busy = feed({ id: 1 });
    const halfYear = feed({ id: 2, lastPosted: NOW - 200 * DAY });
    const year = feed({ id: 3, lastPosted: NOW - 400 * DAY });
    const neverOld = feed({ id: 4, lastPosted: null });
    const neverNew = feed({ id: 5, lastPosted: null, addedAt: NOW - 10 * DAY });
    const all = [busy, halfYear, year, neverOld, neverNew];
    expect(shown(all, "all", NOW)).toEqual(all);
    expect(shown(all, "6", NOW).map((f) => f.id)).toEqual([2, 3, 4]);
    expect(shown(all, "12", NOW).map((f) => f.id)).toEqual([3, 4]);
    expect(isQuiet(feed({ lastPosted: NOW - 181 * DAY }), 6, NOW)).toBe(false);
  });

  it("says when each feed last posted", () => {
    const now = new Date(2026, 9, 25, 15, 0);
    const at = (date: Date) => Math.floor(date.getTime() / 1000);
    expect(lastPostedWords(feed({ lastPosted: at(new Date(2026, 9, 25, 9, 0)) }), now)).toBe("Last posted today");
    expect(lastPostedWords(feed({ lastPosted: at(new Date(2026, 2, 3)) }), now)).toBe("Last posted on 3 Mar");
    expect(lastPostedWords(feed({ lastPosted: at(new Date(2025, 9, 3)) }), now)).toBe("Last posted on 3 Oct 2025");
    expect(lastPostedWords(feed({ lastPosted: null }), now)).toBe("Nothing posted yet");
  });

  it("names a feed's folders A to Z", () => {
    const folders = [
      { id: 2, name: "News" },
      { id: 1, name: "Tech" },
    ];
    expect(folderNames(feed({ folders: [1, 2] }), folders)).toEqual(["News", "Tech"]);
  });

  it("says what was done, naming one feed or counting several", () => {
    expect(movedMessage(["Alpha"], "Tech")).toBe("Moved Alpha to Tech.");
    expect(movedMessage(["Alpha", "Beta"], "Tech")).toBe("Moved 2 feeds to Tech.");
    expect(movedMessage(["Alpha", "Beta"], null)).toBe("Took 2 feeds out of every folder.");
    expect(unsubscribedMessage(["Alpha", "Beta", "Gamma"])).toBe("Unsubscribed from 3 feeds.");
    expect(unsubscribedMessage(["Alpha"])).toBe("Unsubscribed from Alpha.");
  });
});
