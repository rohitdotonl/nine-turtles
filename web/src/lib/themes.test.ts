import { describe, expect, it } from "vitest";
import { APPEARANCES, LOOKS, THEMES, isAppearance, isTheme, resolveMode, savedTheme } from "./themes";

describe("themes", () => {
  it("has the four themes from DESIGN.md: Original, Plain, Fountain pen and Signal (decision 0145)", () => {
    expect(THEMES).toEqual(["original", "plain", "fountain-pen", "signal"]);
    expect(THEMES.map((theme) => LOOKS[theme].label)).toEqual(["Original", "Plain", "Fountain pen", "Signal"]);
  });

  it("moves a reader on a retired theme to its successor, so nobody lands on a missing theme", () => {
    expect(savedTheme("brushed")).toBe("original");
    expect(savedTheme("anodised")).toBe("fountain-pen");
    expect(savedTheme("heather")).toBe("fountain-pen");
    for (const theme of THEMES) expect(savedTheme(theme)).toBe(theme);
    expect(savedTheme("calm")).toBe("original");
    expect(savedTheme("constructor")).toBe("original");
    expect(savedTheme(undefined)).toBe("original");
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
