// The first design floor, checked from the color definitions themselves, so
// pairs that no screen shows yet (a read item's grey title on the selected
// row's tint, say) are covered too. The browser tests check what's on screen.
import { describe, expect, it } from "vitest";
import css from "../app.css?raw";
import html from "../../index.html?raw";
import { BAR_COLORS } from "./preferences";
import { LOOKS, THEMES as THEME_NAMES, type Mode } from "./themes";

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

// Every theme's day and night versions (decision 0046), by name ("calm dark"),
// and the night version a dark device gets before slowfeed's script runs.
const MODES: Mode[] = ["light", "dark"];
const SELECTORS: Record<string, string> = {
  ...Object.fromEntries(
    THEME_NAMES.flatMap((name) => MODES.map((mode) => [`${name} ${mode}`, `:root[data-theme="${name}"][data-mode="${mode}"]`])),
  ),
  "device dark": ":root:not([data-mode])",
};
const THEMES: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(SELECTORS).map(([name, selector]) => [name, theme(selector)]),
);
const BACKGROUNDS = ["paper", "list", "sidebar", "tint-list", "tint-sidebar"];

describe.each(Object.entries(THEMES))("the %s theme", (_name, colors) => {
  it("defines every color", () => {
    for (const name of ["ink", "ink-2", "muted", "accent", "danger", "surface-raised", ...BACKGROUNDS]) expect(colors[name], name).toMatch(/^#/);
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

// The faint tones under a pointer, behind a search chip and filling the search
// field are the text color mixed into whatever is behind them, read from
// app.css (--hover, --tone, --search-fill).
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
    const shares = ["hover", "tone", "search-fill"].map((name) => {
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

describe.each(Object.entries(THEMES))("the %s theme's search field", (_name, colors) => {
  // A chip (the place searched, a filter) is the chip tone laid over the field's fill (decision 0051).
  it("keeps a chip's words at 4.5 : 1, where the faint tones stack", () => {
    const share = (name: string) =>
      Number(css.match(new RegExp(`--${name}: color-mix\\(in srgb, var\\(--ink\\) (\\d+)%, transparent\\)`))![1]) / 100;
    const stacked = 1 - (1 - share("search-fill")) * (1 - share("tone"));
    for (const background of ["list", "sidebar"]) {
      expect(contrast(colors.ink!, mix(colors.ink!, colors[background]!, stacked)), background).toBeGreaterThanOrEqual(4.5);
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

// The selection pill: in a light theme the accent mixed into the pane at 12%
// (decisions 0037 and 0051); in a dark one the theme's own text color at 12%, so it
// keeps the pane's warmth or coolness (decision 0041). The text checks above
// cover it. Three night versions whose panes are already light for the dark
// mix in less, so their text keeps 7 : 1 on the pill (decision 0046).
const LIGHTER_PILLS: Record<string, number> = { "quiet dark": 0.09, "paper dark": 0.1, "calm dark": 0.1 };

describe.each(Object.entries(THEMES))("the %s theme's selection pill", (name, colors) => {
  const dark = luminance(colors.paper!) < 0.5;
  it(dark ? "is the text color mixed into the list and the sidebar" : "is the accent mixed into the list and the sidebar", () => {
    const [from, share] = dark ? [colors.ink!, LIGHTER_PILLS[name] ?? 0.12] : [colors.accent!, 0.12];
    expect(colors["tint-list"]).toBe(mix(from, colors.list!, share));
    expect(colors["tint-sidebar"]).toBe(mix(from, colors.sidebar!, share));
  });

  // A dark pane's warmth is how far red sits above blue; the pill may lift
  // the pane but never swing it from warm to cool or back (a blue-grey pill
  // on warm brown read as a clash, decision 0041).
  it.runIf(dark)("keeps the pane's temperature", () => {
    const warmth = (hex: string) => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);
    for (const area of ["list", "sidebar"]) {
      const [pane, pill] = [warmth(colors[area]!), warmth(colors[`tint-${area}`]!)];
      if (pane === 0) expect(Math.abs(pill), area).toBeLessThanOrEqual(2);
      else expect(Math.sign(pill), area).toBe(Math.sign(pane));
    }
  });

  it("stays at 7 : 1 for text and 4.5 : 1 for muted grey, with the unread dot and the sidebar's place icon (decision 0043) at 3 : 1", () => {
    for (const area of ["list", "sidebar"]) {
      const pill = colors[`tint-${area}`]!;
      expect(contrast(colors.ink!, pill), area).toBeGreaterThanOrEqual(7);
      expect(contrast(colors.muted!, pill), area).toBeGreaterThanOrEqual(4.5);
      // A read title on the selected row is in full ink, but the sidebar's other names are the second ink.
      expect(contrast(colors["ink-2"]!, pill), area).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.accent!, pill), area).toBeGreaterThanOrEqual(3);
    }
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
// The search tone is the accent at 12%, set with the other faint tones; a
// night version whose panes are light for the dark sets a fainter one in its
// own block, so text keeps 7 : 1 on it inside the pill.
function markShare(name: string): number {
  const pattern = /--mark: color-mix\(in srgb, var\(--accent\) (\d+)%, transparent\);/;
  const start = css.indexOf(SELECTORS[name]!);
  const own = css.slice(start, css.indexOf("}", start)).match(pattern);
  const shared = css.slice(css.indexOf("--hover: color-mix")).match(pattern);
  expect(shared).not.toBeNull();
  return Number((own ?? shared)![1]) / 100;
}

describe.each(Object.entries(THEMES))("the %s theme's search highlight", (name, colors) => {
  it("keeps text at 7 : 1 and the second ink at 4.5 : 1, and stays a visible tone", () => {
    const share = markShare(name);
    expect(share).toBeGreaterThanOrEqual(0.06);
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

// A grouped list (Settings, Edit feed's folders) and a chosen segment on it
// (decision 0042): in a light theme the group is the list's tone and the
// segment the page's; in a dark one each is the text color mixed into the
// page, read from the theme's block in app.css.
function darkShare(selector: string, name: string): number | undefined {
  const start = css.indexOf(selector);
  const block = css.slice(start, css.indexOf("}", start));
  const found = block.match(new RegExp(`--${name}: color-mix\\(in srgb, var\\(--ink\\) (\\d+)%, var\\(--paper\\)\\);`));
  return found ? Number(found[1]) / 100 : undefined;
}

describe.each(Object.entries(SELECTORS))(
  "the %s theme's grouped lists",
  (name, selector) => {
    const colors = THEMES[name]!;
    const dark = luminance(colors.paper!) < 0.5;
    const groupShare = darkShare(selector, "group");
    const raisedShare = darkShare(selector, "raised");
    const group = dark ? mix(colors.ink!, colors.paper!, groupShare!) : colors.list!;
    const raised = dark ? mix(colors.ink!, colors.paper!, raisedShare!) : colors.paper!;
    const track = mix(colors.ink!, group, 0.07);

    it("set a dark theme's group a clear step off the page", () => {
      if (!dark) return expect(groupShare).toBeUndefined();
      expect(groupShare).toBeGreaterThanOrEqual(0.06);
      expect(contrast(group, colors.paper!)).toBeGreaterThan(contrast(colors.list!, colors.paper!));
    });

    it("keep text at 7 : 1 and the second ink, muted grey and red at 4.5 : 1 on the group and under a pointer", () => {
      for (const background of [group, mix(colors.ink!, group, 0.05)]) {
        expect(contrast(colors.ink!, background)).toBeGreaterThanOrEqual(7);
        for (const color of ["ink-2", "muted", "danger"]) expect(contrast(colors[color]!, background), color).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("raise the chosen segment above its track, with its words at 4.5 : 1", () => {
      // Lighter than its track: the page's own tone in a light theme, a lighter mix in a dark one.
      expect(luminance(raised)).toBeGreaterThan(luminance(track));
      expect(contrast(colors.ink!, raised)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors["ink-2"]!, track)).toBeGreaterThanOrEqual(4.5);
    });
  },
);

// What floats over the page (sheets, menus, popovers, the note at the list's
// foot; decision 0052): by day the page itself, by night a small lift above
// it. Text on it keeps the page's own levels, under a pointer and on a chip
// too, and so do grouped rows inside it (4% white over it, read from app.css).
describe.each(Object.entries(THEMES))("the %s theme's raised surface", (_name, colors) => {
  const raised = colors["surface-raised"]!;
  const dark = luminance(colors.paper!) < 0.5;

  it(dark ? "is lifted above the page, keeping its temperature" : "is the page itself", () => {
    expect(raised).toMatch(/^#/);
    if (!dark) return expect(raised).toBe(colors.paper);
    expect(luminance(raised)).toBeGreaterThan(luminance(colors.paper!));
    // A small lift, not a grey card: still well under the text's own tone.
    expect(contrast(raised, colors.paper!)).toBeLessThan(1.6);
    const warmth = (hex: string) => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);
    if (warmth(colors.paper!) > 2) expect(warmth(raised)).toBeGreaterThan(0);
  });

  it("keeps text at 7 : 1 and the second ink, muted grey, red and accent mark at their levels, under a pointer and on a chip, and in a group inside it", () => {
    const share = (name: string) => Number(css.match(new RegExp(`--${name}: color-mix\\(in srgb, var\\(--ink\\) (\\d+)%, transparent\\)`))![1]) / 100;
    const groupShare = Number(css.match(/--raised-group: color-mix\(in srgb, #ffffff (\d+)%, var\(--surface-raised\)\);/)![1]) / 100;
    const group = dark ? mix("#ffffff", raised, groupShare) : raised;
    // The surface, a button or chip on it, a group inside it and a row of that group under a pointer.
    // The red (Unsubscribe, Delete) sits on the surface itself (or its pointer tone), never on a chip or in a group there.
    const hover = (base: string) => mix(colors.ink!, base, share("hover"));
    const onSurface = [raised, hover(raised), mix(colors.ink!, raised, share("tone"))];
    for (const background of [...onSurface, group, hover(group)]) {
      expect(contrast(colors.ink!, background), background).toBeGreaterThanOrEqual(7);
      for (const color of ["ink-2", "muted"]) expect(contrast(colors[color]!, background), `${color} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const background of [raised, hover(raised)]) expect(contrast(colors.danger!, background), `danger on ${background}`).toBeGreaterThanOrEqual(4.5);
    for (const base of [raised, group]) expect(contrast(colors.accent!, base)).toBeGreaterThanOrEqual(3);
  });
});

it("covers all six themes by day and by night", () => {
  expect(Object.keys(THEMES)).toHaveLength(THEME_NAMES.length * 2 + 1);
});

it("before slowfeed's script runs, a page is Original: by day, or by night on a dark device", () => {
  expect(THEMES["device dark"]).toEqual(THEMES["original dark"]);
  expect(theme(":root,")).toEqual(THEMES["original light"]);
});

it("each theme's tile in Settings uses its own page, sidebar and text colors, by day and by night", () => {
  for (const name of THEME_NAMES) {
    for (const mode of MODES) {
      const colors = THEMES[`${name} ${mode}`]!;
      const look = LOOKS[name][mode];
      expect([look.page, look.side, look.ink], `${name} ${mode}`).toEqual([colors.paper, colors.sidebar, colors.ink]);
    }
  }
});

it("the browser bar uses each version's own background", () => {
  for (const [name, colors] of Object.entries(BAR_COLORS)) {
    for (const mode of MODES) expect(colors[mode].toLowerCase(), `${name} ${mode}`).toBe(THEMES[`${name} ${mode}`]!.paper);
  }
  // index.html's light and dark bars, before the script runs: Original's.
  expect(html).toContain(`content="${BAR_COLORS.original.light}" media="(prefers-color-scheme: light)"`);
  expect(html).toContain(`content="${BAR_COLORS.original.dark}" media="(prefers-color-scheme: dark)"`);
});

describe("the summary-only note's link underline", () => {
  const found = css.match(/\.article-note a \{[^}]*text-decoration-color: color-mix\(in srgb, currentColor (\d+)%, transparent\)/);
  const share = Number(found?.[1]) / 100;

  it("is set as a share of the note's own color", () => {
    expect(found).not.toBeNull();
    expect(share).toBeLessThan(1);
  });

  // The link is the same color as the words around it, so its underline is the only sign it's a link (decision 0044).
  it.each(Object.entries(THEMES))("stands out at 3 : 1 on the page in the %s theme", (_name, colors) => {
    expect(contrast(mix(colors["ink-2"]!, colors.paper!, share), colors.paper!)).toBeGreaterThanOrEqual(3);
  });

  it("covers every theme", () => {
    expect(Object.keys(THEMES).length).toBeGreaterThanOrEqual(THEME_NAMES.length);
  });
});
