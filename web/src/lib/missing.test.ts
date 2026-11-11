import { describe, expect, it } from "vitest";
import { wideWords } from "./missing";

describe("a table wider than the column", () => {
  it("says how to see the rest, and how much there is", () => {
    expect(wideWords(14, false)).toBe("Scroll the table sideways to see all 14 columns.");
    expect(wideWords(14, true)).toBe("Swipe the table sideways to see all 14 columns.");
    expect(wideWords(1, false)).toBe("Scroll the table sideways to see all of it.");
  });
});
