import { describe, expect, it } from "vitest";
import { locate, squeezed, tidy, withTimes } from "./highlights";

describe("finding a highlight's words again", () => {
  const text = squeezed("The slow letter came. Then a slow letter went back, and the slow letter waited.");

  it("ignores spaces and line breaks, as a page lays text out its own way", () => {
    expect(squeezed("one\n\n two  three")).toBe("onetwothree");
    expect(tidy("  one\n\n two  ")).toBe("one two");
  });

  it("takes the place whose text either side matches best", () => {
    const quote = squeezed("slow letter");
    expect(locate(text, quote, "", "")).toBe(text.indexOf(quote));
    expect(locate(text, quote, squeezed("Then a"), squeezed("went back"))).toBe(text.indexOf(quote, text.indexOf(quote) + 1));
    expect(locate(text, quote, squeezed("and the"), "")).toBe(text.lastIndexOf(quote));
  });

  it("compares punctuation either way, as an English article's is shown set properly (decision 0247)", () => {
    expect(squeezed("“It’s late” — she said…")).toBe(squeezed(`"It's late" -- she said...`));
    const shown = squeezed("She said “wait”—and left.");
    expect(locate(shown, squeezed(`"wait"--and`), "", "")).toBe(squeezed("She said").length);
  });

  it("finds nothing when the words are no longer there", () => {
    expect(locate(text, squeezed("a quick note"), "", "")).toBeUndefined();
    expect(locate(text, "", "", "")).toBeUndefined();
  });
});

describe("times in a note", () => {
  it("are pieces of their own, in seconds", () => {
    expect(withTimes("12:34 she says it here, and again at 1:02:03.")).toEqual([
      { text: "12:34", seconds: 754 },
      { text: " she says it here, and again at " },
      { text: "1:02:03", seconds: 3723 },
      { text: "." },
    ]);
  });

  it("leave words that only look like times alone", () => {
    expect(withTimes("Ratio 3:75, no time")).toEqual([{ text: "Ratio 3:75, no time" }]);
  });
});
