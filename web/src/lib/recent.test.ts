import { describe, expect, it } from "vitest";
import { RECENT_MS, changesSoFar, forgetRecent, noteRecent, recentPage } from "./recent";
import type { Page } from "./shapes";

const page: Page = { articles: [], next: null, latest: 5 };

describe("a list fetched just now (decision 0314)", () => {
  it("shows again at once for a minute, then is asked for afresh", () => {
    forgetRecent();
    noteRecent("/api/articles?view=unread&order=newest", page, changesSoFar(), 1_000);
    expect(recentPage("/api/articles?view=unread&order=newest", 1_000 + RECENT_MS - 1)).toBe(page);
    expect(recentPage("/api/articles?view=starred&order=newest", 1_000)).toBeUndefined();
    expect(recentPage("/api/articles?view=unread&order=newest", 1_000 + RECENT_MS)).toBeUndefined();
  });

  it("is forgotten by any change, and a page asked for before the change isn't kept", () => {
    forgetRecent();
    noteRecent("/api/articles?view=all&order=newest", page, changesSoFar(), 1_000);
    const asked = changesSoFar();
    forgetRecent();
    expect(recentPage("/api/articles?view=all&order=newest", 1_000)).toBeUndefined();
    noteRecent("/api/articles?view=all&order=newest", page, asked, 1_000);
    expect(recentPage("/api/articles?view=all&order=newest", 1_000)).toBeUndefined();
  });
});
