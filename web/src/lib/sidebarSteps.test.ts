import { describe, expect, it } from "vitest";
import { rowsDrawn, rowsUpTo } from "./sidebarSteps";

describe("drawing a long sidebar in steps (decision 0315)", () => {
  it("spends the rows on each part in the order they show", () => {
    expect(rowsDrawn([2, 30, 50, 10], 40)).toEqual({ counts: [2, 30, 8, 0], all: false });
    expect(rowsDrawn([2, 30, 50, 10], 100)).toEqual({ counts: [2, 30, 50, 10], all: true });
  });

  it("counts an empty part as drawn", () => {
    expect(rowsDrawn([0, 0], 0)).toEqual({ counts: [0, 0], all: true });
  });

  it("counts the rows down to where you are, so the first step reaches it", () => {
    expect(rowsUpTo([[1, 2], [3, 4, 5], [6]], (row) => row === 4)).toBe(4);
    expect(rowsUpTo([[1, 2], [3]], (row) => row === 9)).toBe(0);
  });
});
