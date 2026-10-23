// The first design floor, checked from the color definitions themselves, so
// pairs that no screen shows yet (a read item's grey title on the selected
// row's tint, say) are covered too. The browser tests check what's on screen.
import { describe, expect, it } from "vitest";
import css from "../app.css?raw";

/** The color settings of one theme's block in app.css. */
function theme(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const THEMES = {
  "off-white": theme(':root[data-theme="off-white"]'),
  sepia: theme(':root[data-theme="sepia"]'),
  dark: theme(':root[data-theme="dark"]'),
  "device dark": theme(":root:not([data-theme])"),
};
const BACKGROUNDS = ["paper", "list", "sidebar", "tint-list", "tint-sidebar"];

describe.each(Object.entries(THEMES))("the %s theme", (_name, colors) => {
  it("defines every color", () => {
    for (const name of ["ink", "muted", "accent", ...BACKGROUNDS]) expect(colors[name], name).toMatch(/^#/);
  });

  it("has text at AAA (7 : 1) on the reading area, and AA or better everywhere", () => {
    expect(contrast(colors.ink!, colors.paper!)).toBeGreaterThanOrEqual(7);
    for (const background of BACKGROUNDS) {
      expect(contrast(colors.ink!, colors[background]!), background).toBeGreaterThanOrEqual(7);
    }
  });

  it("has muted grey text at AA (4.5 : 1) on every area and on the selected-row tint", () => {
    for (const background of BACKGROUNDS) {
      expect(contrast(colors.muted!, colors[background]!), background).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("has the ink blue mark clearly visible (3 : 1) wherever it's drawn", () => {
    for (const background of BACKGROUNDS) {
      expect(contrast(colors.accent!, colors[background]!), background).toBeGreaterThanOrEqual(3);
    }
  });

  it("tells the three areas apart by tone, deeper from reading area to sidebar", () => {
    const order = [colors.paper!, colors.list!, colors.sidebar!].map(luminance);
    const lightTheme = order[0]! > 0.5;
    expect(lightTheme ? order[0]! > order[1]! && order[1]! > order[2]! : order[0]! < order[1]! && order[1]! < order[2]!).toBe(true);
  });
});

it("the device's dark setting uses exactly the dark theme's colors", () => {
  expect(THEMES["device dark"]).toEqual(THEMES.dark);
});
