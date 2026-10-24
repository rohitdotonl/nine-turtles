import { describe, expect, it } from "vitest";
import { FIRST_THEMES, THEMES, isTheme } from "./themes";

describe("themes", () => {
  it("lists the themes in DESIGN.md, lights first, the three first ones among them", () => {
    expect(THEMES).toEqual(["off-white", "sepia", "porcelain", "linen", "mist", "sage", "dark", "graphite", "night", "midnight", "black"]);
    for (const theme of FIRST_THEMES) expect(THEMES).toContain(theme);
  });

  it("recognises only known theme names", () => {
    expect(isTheme("sepia")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});
