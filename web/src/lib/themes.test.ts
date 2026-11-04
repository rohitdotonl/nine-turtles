import { describe, expect, it } from "vitest";
import { LOOKS, PAGES, THEMES, isPage, showing } from "./themes";

describe("pages", () => {
  it("has the three pages from DESIGN.md, White, Paper and Night, and Match device (decision 0176)", () => {
    expect(THEMES).toEqual(["white", "paper", "night"]);
    expect(THEMES.map((theme) => LOOKS[theme].label)).toEqual(["White", "Paper", "Night"]);
    expect(PAGES.map((choice) => choice.label)).toEqual(["White", "Paper", "Night", "Match device"]);
    expect(THEMES.map((theme) => LOOKS[theme].mode)).toEqual(["light", "light", "dark"]);
  });

  it("recognises only the choices it offers", () => {
    for (const choice of PAGES) expect(isPage(choice.value)).toBe(true);
    for (const old of ["original", "plain", "fountain-pen", "signal", "light", "dark", "constructor", undefined]) expect(isPage(old)).toBe(false);
  });

  it("shows the page chosen, and for Match device White by day and Night by night", () => {
    expect(showing("paper", true)).toBe("paper");
    expect(showing("night", false)).toBe("night");
    expect(showing("auto", true)).toBe("night");
    expect(showing("auto", false)).toBe("white");
  });
});
