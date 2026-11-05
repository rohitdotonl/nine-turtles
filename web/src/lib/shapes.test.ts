import { describe, expect, it } from "vitest";
import { toExcerpt } from "./shapes";

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
