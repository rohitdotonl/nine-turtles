// The reader controls in Settings (SPEC section 18). They belong to this
// device, not to the reader's account: a phone and a laptop often want
// different sizes. So they're kept in the browser's own storage, and nothing
// is lost if that storage is unavailable: nine turtles simply uses the defaults.
import { LOOKS, OLD_THEMES, THEMES, isAppearance, isTheme, resolveMode, type Appearance, type Mode, type Theme } from "./themes";

export type ReadingFont = "literata" | "atkinson" | "system-serif";
export type LineWidth = "narrow" | "medium" | "wide";

export type Preferences = {
  theme: Theme;
  /** Day, night, or as the device is set (decision 0046). */
  appearance: Appearance;
  readingFont: ReadingFont;
  /** A step in TEXT_SIZES. `+` and `-` move through the same steps (Milestone 6). */
  textSize: number;
  lineWidth: LineWidth;
};

export const TEXT_SIZES = [
  { label: "Smaller", rem: 1 },
  { label: "Small", rem: 1.125 },
  { label: "Medium", rem: 1.25 },
  { label: "Large", rem: 1.375 },
  { label: "Larger", rem: 1.5 },
  { label: "Largest", rem: 1.75 },
] as const;

// DESIGN.md: an article line of roughly 65–75 characters. A "ch" is the
// width of a zero, wider than an average letter, so 57ch holds about 67.
export const LINE_WIDTHS: Record<LineWidth, { label: string; ch: number }> = {
  narrow: { label: "Narrow", ch: 52 },
  medium: { label: "Medium", ch: 57 },
  wide: { label: "Wide", ch: 63 },
};

/** `rest` is the end of a long name, said to screen readers but not shown, so three choices fit one row. */
export const READING_FONTS: Record<ReadingFont, { label: string; rest?: string; family: string }> = {
  literata: { label: "Literata", family: "var(--font-serif)" },
  atkinson: { label: "Atkinson", rest: " Hyperlegible", family: '"Atkinson Hyperlegible", var(--font-sans)' },
  // rohit.onl's font (decision 0059): the device's own serif, New York on Apple
  // devices and Georgia on most others. Nothing to download.
  "system-serif": { label: "System serif", family: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
};

function isReadingFont(value: unknown): value is ReadingFont {
  return typeof value === "string" && Object.hasOwn(READING_FONTS, value);
}

export const DEFAULTS: Preferences = { theme: "original", appearance: "auto", readingFont: "literata", textSize: 2, lineWidth: "medium" };

const KEY = "nine-turtles.preferences";
/** Where they were saved before the rename; read when there's nothing under the new name. */
const OLD_KEY = "slowfeed.preferences";

/** Reads the saved preferences, keeping only values nine turtles understands. */
export function load(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Preferences {
  let saved: unknown;
  try {
    saved = JSON.parse(storage?.getItem(KEY) ?? storage?.getItem(OLD_KEY) ?? "null");
  } catch {
    saved = null;
  }
  const s = typeof saved === "object" && saved !== null ? (saved as Record<string, unknown>) : {};
  // A theme saved by an earlier version becomes Original, keeping its Appearance (decision 0056).
  const old = typeof s.theme === "string" && Object.hasOwn(OLD_THEMES, s.theme) ? OLD_THEMES[s.theme] : undefined;
  return {
    theme: isTheme(s.theme) ? s.theme : (old?.theme ?? DEFAULTS.theme),
    appearance: isAppearance(s.appearance) ? s.appearance : (old?.appearance ?? DEFAULTS.appearance),
    readingFont: isReadingFont(s.readingFont) ? s.readingFont : DEFAULTS.readingFont,
    textSize:
      typeof s.textSize === "number" && Number.isInteger(s.textSize) && s.textSize >= 0 && s.textSize < TEXT_SIZES.length
        ? s.textSize
        : DEFAULTS.textSize,
    lineWidth: s.lineWidth === "narrow" || s.lineWidth === "medium" || s.lineWidth === "wide" ? s.lineWidth : DEFAULTS.lineWidth,
  };
}

export function save(preferences: Preferences, storage: Pick<Storage, "setItem"> | undefined = safeStorage()): void {
  try {
    storage?.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // Storage is full or switched off. The choice still applies until the page closes.
  }
}

/** Whether the device is set to dark right now; false where that can't be asked. */
export function deviceIsDark(): boolean {
  try {
    return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Puts the preferences into effect on the page (see app.css). `deviceDark`
 * decides the version for "Match device"; appearance.svelte.ts keeps it up
 * to date when the device switches.
 */
export function apply(preferences: Preferences, root: HTMLElement = document.documentElement, deviceDark = deviceIsDark()): void {
  const mode: Mode = resolveMode(preferences.appearance, deviceDark);
  root.dataset.theme = preferences.theme;
  root.dataset.mode = mode;
  const font = READING_FONTS[preferences.readingFont];
  root.style.setProperty("--reading-font", font.family);
  root.style.setProperty("--reading-size", `${TEXT_SIZES[preferences.textSize]?.rem ?? 1.25}rem`);
  root.style.setProperty("--reading-measure", `${LINE_WIDTHS[preferences.lineWidth].ch}ch`);
  // The phone's own bar above the page takes the showing version's background
  // too (index.html starts with Original's, by day and by night).
  for (const meta of root.ownerDocument?.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]') ?? []) {
    meta.content = BAR_COLORS[preferences.theme][mode];
  }
}

/**
 * The theme's reading background by day and by night (DESIGN.md → "Color"),
 * for the browser's bar. contrast.test.ts checks they match app.css and
 * index.html.
 */
export const BAR_COLORS = Object.fromEntries(
  THEMES.map((theme) => [theme, { light: LOOKS[theme].light.page.toUpperCase(), dark: LOOKS[theme].dark.page.toUpperCase() }]),
) as Record<Theme, Record<Mode, string>>;

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
