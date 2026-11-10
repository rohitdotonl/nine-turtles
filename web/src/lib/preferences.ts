// The reader controls in Settings (SPEC section 18). They belong to this
// device, not to the reader's account: a phone and a laptop often want
// different sizes. So they're kept in the browser's own storage, and nothing
// is lost if that storage is unavailable: nine turtles simply uses the defaults.
import { LOOKS, isPage, showing, type Page } from "./themes";
import { deviceStorage } from "./device";
import { isRecord } from "./http";

export type ReadingFont = "literata" | "atkinson" | "system-serif";

export type Preferences = {
  /** The page: White, Paper, Night, or Match device (decision 0176). */
  page: Page;
  readingFont: ReadingFont;
  /** A step in TEXT_SIZES. `+` and `-` move through the same steps (Milestone 6). */
  textSize: number;
};

/** Each size's line spacing (decision 0246): larger text needs less room between lines, as a book's does. */
export const TEXT_SIZES = [
  { label: "Smaller", rem: 1, leading: 1.6 },
  { label: "Small", rem: 1.125, leading: 1.58 },
  { label: "Medium", rem: 1.25, leading: 1.55 },
  { label: "Large", rem: 1.375, leading: 1.52 },
  { label: "Larger", rem: 1.5, leading: 1.5 },
  { label: "Largest", rem: 1.75, leading: 1.45 },
] as const;

/**
 * `rest` is the end of a long name, said to screen readers but not shown, so three choices fit one row.
 * `title` is the face for an article's title, where it isn't the text's own: Literata's display cut (decision 0246).
 */
export const READING_FONTS: Record<ReadingFont, { label: string; rest?: string; family: string; title?: string }> = {
  literata: { label: "Literata", family: "var(--font-serif)", title: "var(--font-display)" },
  atkinson: { label: "Atkinson", rest: " Hyperlegible Next", family: '"Atkinson Hyperlegible Next", var(--font-sans)' },
  // rohit.onl's font (decision 0063): the device's own serif, New York on Apple
  // devices and Georgia on most others. Nothing to download.
  "system-serif": { label: "System serif", family: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
};

function isReadingFont(value: unknown): value is ReadingFont {
  return typeof value === "string" && Object.hasOwn(READING_FONTS, value);
}

export const DEFAULTS: Preferences = { page: "auto", readingFont: "literata", textSize: 2 };

const KEY = "nine-turtles.preferences";

// Takes a storage (rather than using device.ts) so tests can give their own; deviceStorage() is undefined when the browser refuses.
/** Reads the saved preferences, keeping only values nine turtles understands. */
export function load(storage: Pick<Storage, "getItem"> | undefined = deviceStorage()): Preferences {
  let saved: unknown;
  try {
    saved = JSON.parse(storage?.getItem(KEY) ?? "null");
  } catch {
    saved = null;
  }
  const s = isRecord(saved) ? saved : {};
  return {
    page: isPage(s.page) ? s.page : DEFAULTS.page,
    readingFont: isReadingFont(s.readingFont) ? s.readingFont : DEFAULTS.readingFont,
    textSize:
      typeof s.textSize === "number" && Number.isInteger(s.textSize) && s.textSize >= 0 && s.textSize < TEXT_SIZES.length
        ? s.textSize
        : DEFAULTS.textSize,
  };
}

export function save(preferences: Preferences, storage: Pick<Storage, "setItem"> | undefined = deviceStorage()): void {
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
 * decides the page for "Match device"; appearance.svelte.ts keeps it up
 * to date when the device switches.
 */
export function apply(preferences: Preferences, root: HTMLElement = document.documentElement, deviceDark = deviceIsDark()): void {
  const theme = showing(preferences.page, deviceDark);
  root.dataset.theme = theme;
  root.dataset.mode = LOOKS[theme].mode;
  const font = READING_FONTS[preferences.readingFont];
  root.style.setProperty("--reading-font", font.family);
  root.style.setProperty("--reading-title-font", font.title ?? font.family);
  const size = TEXT_SIZES[preferences.textSize] ?? TEXT_SIZES[2];
  root.style.setProperty("--reading-size", `${size.rem}rem`);
  root.style.setProperty("--reading-leading", String(size.leading));
  // The phone's own bar above the page takes the showing page's color too
  // (index.html starts with White's by day and Night's by night).
  for (const meta of root.ownerDocument?.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]') ?? []) {
    meta.content = LOOKS[theme].page.toUpperCase();
  }
}
