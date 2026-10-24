import { describe, expect, it } from "vitest";
import { APPEARANCES, LOOKS, OLD_THEMES, THEMES, isAppearance, isTheme, resolveMode } from "./themes";

describe("themes", () => {
  it("lists Apple Books' six themes from DESIGN.md, in its order", () => {
    expect(THEMES).toEqual(["original", "quiet", "paper", "bold", "calm", "focus"]);
    expect(THEMES.map((theme) => LOOKS[theme].label)).toEqual(["Original", "Quiet", "Paper", "Bold", "Calm", "Focus"]);
  });

  it("recognises only known theme names and Appearance choices", () => {
    expect(isTheme("calm")).toBe(true);
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

  it("gives every theme from before decision 0046 a new home", () => {
    expect(Object.keys(OLD_THEMES).sort()).toEqual(
      ["system", "off-white", "sepia", "porcelain", "linen", "mist", "sage", "dark", "graphite", "night", "midnight", "black"].sort(),
    );
    for (const choice of Object.values(OLD_THEMES)) {
      expect(isTheme(choice.theme)).toBe(true);
      expect(isAppearance(choice.appearance)).toBe(true);
    }
  });
});
