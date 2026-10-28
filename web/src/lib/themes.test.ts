import { describe, expect, it } from "vitest";
import { APPEARANCES, LOOKS, THEMES, isAppearance, isTheme, resolveMode } from "./themes";

describe("themes", () => {
  it("has the themes from DESIGN.md: Original (decision 0056) and Plain (decision 0063)", () => {
    expect(THEMES).toEqual(["original", "plain"]);
    expect(THEMES.map((theme) => LOOKS[theme].label)).toEqual(["Original", "Plain"]);
  });

  it("recognises only known theme names and Appearance choices", () => {
    expect(isTheme("original")).toBe(true);
    expect(isTheme("calm")).toBe(false);
    expect(isTheme("sepia")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(APPEARANCES.map((choice) => choice.value)).toEqual(["light", "dark", "auto"]);
    expect(APPEARANCES.map((choice) => choice.label)).toEqual(["Light", "Dark", "Match device"]);
    expect(isAppearance("auto")).toBe(true);
    expect(isAppearance("system")).toBe(false);
  });

  it("shows the day or night version as chosen, and the device's for Match device", () => {
    expect(resolveMode("light", true)).toBe("light");
    expect(resolveMode("dark", false)).toBe("dark");
    expect(resolveMode("auto", true)).toBe("dark");
    expect(resolveMode("auto", false)).toBe("light");
  });

});
