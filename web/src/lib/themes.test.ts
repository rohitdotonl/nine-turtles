import { describe, expect, it } from "vitest";
import { THEMES, isTheme } from "./themes";

describe("themes", () => {
  it("lists exactly the three themes in DESIGN.md", () => {
    expect(THEMES).toEqual(["off-white", "sepia", "dark"]);
  });

  it("recognises only known theme names", () => {
    expect(isTheme("sepia")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});
