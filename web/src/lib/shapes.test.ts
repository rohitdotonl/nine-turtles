import { describe, expect, it } from "vitest";
import { toArticle, toExcerpt, untitledOpening } from "./shapes";

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

describe("a post with no title (SPEC section 6)", () => {
  const base = { id: 1, feed_id: 2, feed_title: "Mira", link: null, at: 0 };

  it("is listed by its opening words", () => {
    expect(untitledOpening(toArticle({ ...base, title: "", opening: " Saw the first heron. " }))).toBe("Saw the first heron.");
  });

  it("says Untitled when it has no words", () => {
    expect(untitledOpening(toArticle({ ...base, title: "  " }))).toBe("Untitled");
    expect(untitledOpening(toArticle({ ...base, title: "", opening: "   " }))).toBe("Untitled");
  });

  it("leaves a titled post to its title", () => {
    expect(untitledOpening(toArticle({ ...base, title: "Herons", opening: "Saw the first heron." }))).toBeUndefined();
  });
});
