import { describe, expect, it } from "vitest";
import { checkFrom, toExcerpt } from "./shapes";

describe("search excerpts", () => {
  it("keep only text pieces, each a searched word or not, never HTML", () => {
    expect(
      toExcerpt([
        { text: "Late ", match: false },
        { text: "gardening", match: true },
        { text: "<b>notes</b>", match: "yes" },
        "stray",
        null,
      ]),
    ).toEqual([
      { text: "Late ", match: false },
      { text: "gardening", match: true },
      // Text stays text: Svelte shows it as written, tags and all.
      { text: "<b>notes</b>", match: false },
    ]);
  });
});

describe("each feed's own settings", () => {
  it("reads how often a feed may be checked from the server's shortest wait", () => {
    expect(checkFrom(0)).toBe("automatic");
    expect(checkFrom(60 * 60)).toBe("hourly");
    expect(checkFrom(24 * 60 * 60)).toBe("daily");
  });
});
