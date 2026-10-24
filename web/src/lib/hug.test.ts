import { describe, expect, it } from "vitest";
import { fittingCount } from "./hug";

// Each character 7px wide, the "…" 9px: n characters take 7n.
const even = (n: number) => n * 7;

describe("how much of a cut-short name fits before its ellipsis", () => {
  it("keeps as many characters as fit with the ellipsis after them", () => {
    // 100px of room: 13 characters (91px) and the ellipsis (9px) fit exactly.
    expect(fittingCount(40, even, 9, 100)).toBe(13);
    // A fraction less and the 13th doesn't.
    expect(fittingCount(40, even, 9, 99.5)).toBe(12);
  });

  it("never claims more characters than the name has", () => {
    expect(fittingCount(5, even, 9, 1000)).toBe(5);
  });

  it("keeps none when even the ellipsis barely fits", () => {
    expect(fittingCount(40, even, 9, 10)).toBe(0);
    expect(fittingCount(0, even, 9, 100)).toBe(0);
  });

  it("works with uneven letters, as in a proportional font", () => {
    const widths = [4, 9, 3, 12, 7, 7, 2];
    const widthOf = (n: number) => widths.slice(0, n).reduce((sum, w) => sum + w, 0);
    // 4 + 9 + 3 = 16, + 12 = 28: with a 9px ellipsis, 25px of room holds three.
    expect(fittingCount(widths.length, widthOf, 9, 25)).toBe(3);
    expect(fittingCount(widths.length, widthOf, 9, 37)).toBe(4);
  });
});
