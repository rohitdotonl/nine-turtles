// The reader controls in Settings (SPEC section 18). They belong to this
// device, not to the reader's account: a phone and a laptop often want
// different sizes. So they're kept in the browser's own storage, and nothing
// is lost if that storage is unavailable: slowfeed simply uses the defaults.
import { isTheme, type Theme } from "./themes";

export type ThemeChoice = "system" | Theme;
export type ReadingFont = "literata" | "atkinson";
export type LineWidth = "narrow" | "medium" | "wide";

export type Preferences = {
  theme: ThemeChoice;
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

// DESIGN.md: an article line of roughly 65–75 characters.
export const LINE_WIDTHS: Record<LineWidth, { label: string; ch: number }> = {
  narrow: { label: "Narrow", ch: 62 },
  medium: { label: "Medium", ch: 68 },
  wide: { label: "Wide", ch: 75 },
};

export const READING_FONTS: Record<ReadingFont, { label: string; family: string }> = {
  literata: { label: "Literata", family: "var(--font-serif)" },
  atkinson: { label: "Atkinson Hyperlegible", family: '"Atkinson Hyperlegible", var(--font-sans)' },
};

export const DEFAULTS: Preferences = { theme: "system", readingFont: "literata", textSize: 2, lineWidth: "medium" };

const KEY = "slowfeed.preferences";

/** Reads the saved preferences, keeping only values slowfeed understands. */
export function load(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): Preferences {
  let saved: unknown;
  try {
    saved = JSON.parse(storage?.getItem(KEY) ?? "null");
  } catch {
    saved = null;
  }
  const s = typeof saved === "object" && saved !== null ? (saved as Record<string, unknown>) : {};
  return {
    theme: s.theme === "system" || isTheme(s.theme) ? s.theme : DEFAULTS.theme,
    readingFont: s.readingFont === "literata" || s.readingFont === "atkinson" ? s.readingFont : DEFAULTS.readingFont,
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

/** Puts the preferences into effect on the page (see app.css). */
export function apply(preferences: Preferences, root: HTMLElement = document.documentElement): void {
  if (preferences.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = preferences.theme;
  root.style.setProperty("--reading-font", READING_FONTS[preferences.readingFont].family);
  root.style.setProperty("--reading-size", `${TEXT_SIZES[preferences.textSize]?.rem ?? 1.25}rem`);
  root.style.setProperty("--reading-measure", `${LINE_WIDTHS[preferences.lineWidth].ch}ch`);
}

function safeStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
