// The first design floor, checked from the color definitions themselves, so
// pairs that no screen shows yet (a read item's grey title on the selected
// row's tint, say) are covered too. The browser tests check what's on screen.
import { describe, expect, it } from "vitest";
import css from "../app.css?raw";
import html from "../../index.html?raw";
import { BAR_COLORS } from "./preferences";
import { LOOKS, THEMES as THEME_NAMES } from "./themes";

/** The color settings of one theme's block in app.css. */
function theme(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));
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

const THEMES: Record<string, Record<string, string>> = {
  ...Object.fromEntries(THEME_NAMES.map((name) => [name, theme(`:root[data-theme="${name}"]`)])),
  "device dark": theme(":root:not([data-theme])"),
};
const BACKGROUNDS = ["paper", "list", "sidebar", "tint-list", "tint-sidebar"];

describe.each(Object.entries(THEMES))("the %s theme", (_name, colors) => {
  it("defines every color", () => {
    for (const name of ["ink", "ink-2", "muted", "accent", "danger", ...BACKGROUNDS]) expect(colors[name], name).toMatch(/^#/);
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

  it("has a second text color (read titles, labels) at AA everywhere, between text and muted grey", () => {
    for (const background of BACKGROUNDS) {
      expect(contrast(colors["ink-2"]!, colors[background]!), background).toBeGreaterThanOrEqual(4.5);
    }
    // Three clear levels of ink on the reading area: text, then ink-2, then muted.
    const levels = [colors.ink!, colors["ink-2"]!, colors.muted!].map((color) => contrast(color, colors.paper!));
    expect(levels[0]! > levels[1]! && levels[1]! > levels[2]!).toBe(true);
  });

  it("has the destructive red (Unsubscribe, Delete) at AA on the sheet and the page", () => {
    expect(contrast(colors.danger!, colors.paper!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.danger!, colors.list!)).toBeGreaterThanOrEqual(4.5);
  });

  it("has the accent at AAA (7 : 1) on the reading area", () => {
    expect(contrast(colors.accent!, colors.paper!)).toBeGreaterThanOrEqual(7);
  });

  it("has the accent mark clearly visible (3 : 1) wherever it's drawn", () => {
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

// The faint tones under a pointer and behind a search chip are the text color
// mixed into whatever is behind them, read from app.css (--hover, --tone).
function mix(ink: string, background: string, share: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  return (
    "#" +
    [1, 3, 5]
      .map((i) => Math.round(channel(ink, i) * share + channel(background, i) * (1 - share)))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
  );
}

describe.each(Object.entries(THEMES))("the %s theme's pointer and chip tones", (_name, colors) => {
  // Never drawn on the selected row's tint: the selected row isn't tinted under the pointer.
  it("keep text at 7 : 1 and muted grey at 4.5 : 1 on the three areas", () => {
    const shares = ["hover", "tone"].map((name) => {
      const found = css.match(new RegExp(`--${name}: color-mix\\(in srgb, var\\(--ink\\) (\\d+)%, transparent\\)`));
      expect(found, name).not.toBeNull();
      return Number(found![1]) / 100;
    });
    for (const share of shares) {
      for (const background of ["paper", "list", "sidebar"]) {
        const toned = mix(colors.ink!, colors[background]!, share);
        expect(contrast(colors.ink!, toned), `${background} ${share}`).toBeGreaterThanOrEqual(7);
        expect(contrast(colors.muted!, toned), `${background} ${share}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe.each(Object.entries(THEMES))("the %s theme's keyboard outline on rows", (_name, colors) => {
  it("stands out at 3 : 1 or more on every area a row sits on", () => {
    const found = css.match(/--place-focus: color-mix\(in srgb, var\(--ink\) (\d+)%, transparent\)/);
    expect(found).not.toBeNull();
    const share = Number(found![1]) / 100;
    // Drawn just inside the row's edge, so over the selection's fill too.
    for (const background of ["paper", "list", "sidebar", "tint-list", "tint-sidebar"]) {
      expect(contrast(mix(colors.ink!, colors[background]!, share), colors[background]!), background).toBeGreaterThanOrEqual(3);
    }
  });
});

// The selection pill (decision 0037): the theme's accent mixed into the pane,
// 13% in a light theme and 20% in a dark one. The text checks above cover it.
describe.each(Object.entries(THEMES))("the %s theme's selection pill", (_name, colors) => {
  const dark = luminance(colors.paper!) < 0.5;
  it("is the accent mixed into the list and the sidebar", () => {
    const share = dark ? 0.2 : 0.13;
    expect(colors["tint-list"]).toBe(mix(colors.accent!, colors.list!, share));
    expect(colors["tint-sidebar"]).toBe(mix(colors.accent!, colors.sidebar!, share));
  });

  it("is clearly deeper than a row under the pointer, which stays neutral", () => {
    const share = Number(css.match(/--hover: color-mix\(in srgb, var\(--ink\) (\d+)%, transparent\)/)![1]) / 100;
    for (const area of ["list", "sidebar"]) {
      const hovered = mix(colors.ink!, colors[area]!, share);
      expect(contrast(colors[`tint-${area}`]!, colors[area]!), area).toBeGreaterThan(contrast(hovered, colors[area]!) + 0.05);
    }
  });
});

// A searched word's faint accent tone, on a row or on the selected row.
describe.each(Object.entries(THEMES))("the %s theme's search highlight", (_name, colors) => {
  it("keeps text at 7 : 1 and the second ink at 4.5 : 1", () => {
    const found = css.match(/--mark: color-mix\(in srgb, var\(--accent\) (\d+)%, transparent\)/);
    expect(found).not.toBeNull();
    const share = Number(found![1]) / 100;
    for (const background of ["list", "tint-list"]) {
      const marked = mix(colors.accent!, colors[background]!, share);
      expect(contrast(colors.ink!, marked), background).toBeGreaterThanOrEqual(7);
      expect(contrast(colors["ink-2"]!, marked), background).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe.each(Object.entries(THEMES))("the %s theme's fields", (_name, colors) => {
  const share = (name: string, over: string) => {
    const found = css.match(new RegExp(`--${name}: color-mix\\(in srgb, var\\(--ink\\) (\\d+)%, ${over}\\)`));
    expect(found, name).not.toBeNull();
    return Number(found![1]) / 100;
  };

  it("have an edge that stands out at 3 : 1 on every area a field sits on, though softer than the text", () => {
    const edge = share("field-edge", "transparent");
    expect(edge).toBeLessThan(0.7);
    for (const background of ["paper", "list", "sidebar"]) {
      expect(contrast(mix(colors.ink!, colors[background]!, edge), colors[background]!), background).toBeGreaterThanOrEqual(3);
    }
  });

  it("keep text at 7 : 1, placeholders at 4.5 : 1 and a refused field's red edge at 3 : 1 on their faint fill", () => {
    const fill = mix(colors.ink!, colors.paper!, share("field", "var\\(--paper\\)"));
    expect(contrast(colors.ink!, fill)).toBeGreaterThanOrEqual(7);
    expect(contrast(colors.muted!, fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.danger!, colors.paper!)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.danger!, fill)).toBeGreaterThanOrEqual(3);
    expect(contrast(mix(colors.ink!, colors.paper!, share("field-edge", "transparent")), fill)).toBeGreaterThanOrEqual(3);
  });
});

it("the device's dark setting uses exactly the dark theme's colors", () => {
  expect(THEMES["device dark"]).toEqual(THEMES.dark);
});

it("each theme's picture in Settings uses its own page, sidebar and text colors", () => {
  for (const name of THEME_NAMES) {
    const colors = THEMES[name]!;
    expect([LOOKS[name].page, LOOKS[name].side, LOOKS[name].ink], name).toEqual([colors.paper, colors.sidebar, colors.ink]);
  }
});

it("the browser bar and Settings' theme discs use each theme's own background", () => {
  for (const [name, color] of Object.entries(BAR_COLORS)) {
    expect(color.toLowerCase(), name).toBe(THEMES[name]!.paper);
  }
  // index.html's light and dark bars, for "Automatic".
  expect(html).toContain(`content="${BAR_COLORS["off-white"]}" media="(prefers-color-scheme: light)"`);
  expect(html).toContain(`content="${BAR_COLORS.dark}" media="(prefers-color-scheme: dark)"`);
});
