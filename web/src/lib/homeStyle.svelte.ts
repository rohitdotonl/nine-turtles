// Home redesign, design round only (thread "Redesign Home for clarity"): which of the two versions shows, and
// who is pinned. Both live on this device for now, so Rohit can try them; the version chosen is built properly
// (pins kept on the server, per reader) before anything ships.

export type HomeStyle = "now" | `v${number}`;

/** What each version changes (thread "Redesign Home for clarity": ten versions, from closest to today to wildest). */
export type Look = {
  /** Section headings: shown, hidden (screen readers still hear them), or small quiet words (v9). */
  headings: "shown" | "hidden" | "quiet";
  /** A person's or publication's mark in the icon column. */
  mark: "blank" | "initial" | "glyph" | "none";
  /** How one group is parted from the next. */
  parts: "space" | "hairline" | "cards";
  /** Folders are rows of their own: their people show inside the folder's list, not on Home. */
  shut: boolean;
  /** Pinned people as a grid of faces. */
  faces: boolean;
  /** Saved and Notes as two tiles side by side. */
  pair: boolean;
  /** Folders as tiles, two to a line. */
  tiles: boolean;
  /** Names in the reading serif, as a book's contents page. */
  serif: boolean;
  /** Edit sits beside the wordmark (there's no Folders heading to hold it). */
  editTop: boolean;
};

const base: Look = { headings: "hidden", mark: "initial", parts: "space", shut: false, faces: false, pair: false, tiles: false, serif: false, editTop: true };
export const LOOKS: Record<string, Look> = {
  v1: { ...base, headings: "shown", mark: "blank", editTop: false },
  v2: base,
  v3: { ...base, mark: "glyph", parts: "hairline" },
  v4: { ...base, headings: "shown", parts: "cards", editTop: false },
  v5: { ...base, parts: "cards" },
  v6: { ...base, shut: true },
  v7: { ...base, shut: true, faces: true },
  v8: { ...base, shut: true, faces: true, pair: true, parts: "cards" },
  v9: { ...base, headings: "quiet", mark: "none", shut: true, serif: true, editTop: false },
  v10: { ...base, shut: true, faces: true, pair: true, tiles: true },
};
const ALIASES: Record<string, string> = { safe: "v1", bold: "v2" };

function valid(style: string | null): HomeStyle | undefined {
  if (!style) return undefined;
  const named = ALIASES[style] ?? style;
  return named === "now" || named in LOOKS ? (named as HomeStyle) : undefined;
}

const STYLE_KEY = "nine-turtles-home-style";
const PINS_KEY = "nine-turtles-pins";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private window: it lasts until the page closes.
  }
}

function startingStyle(): HomeStyle {
  const asked = valid(new URLSearchParams(location.search).get("home"));
  if (asked) {
    write(STYLE_KEY, asked);
    return asked;
  }
  return valid(read(STYLE_KEY)) ?? "v2";
}

function startingPins(): number[] {
  try {
    const kept = JSON.parse(read(PINS_KEY) ?? "[]");
    return Array.isArray(kept) ? kept.filter((each) => typeof each === "number") : [];
  } catch {
    return [];
  }
}

/** Up to nine, in the order pinned; never filled by the app. */
export const PIN_LIMIT = 9;

export const home = $state({ style: startingStyle(), pins: startingPins() });

/** The look of the version showing (undefined: Home as it is today). */
export function look(): Look | undefined {
  return LOOKS[home.style];
}

export function setStyle(style: HomeStyle) {
  home.style = style;
  write(STYLE_KEY, style);
}

export function isPinned(id: number): boolean {
  return home.pins.includes(id);
}

/** Pins or unpins someone; false when nine are pinned already. */
export function togglePin(id: number): boolean {
  if (isPinned(id)) home.pins = home.pins.filter((each) => each !== id);
  else if (home.pins.length >= PIN_LIMIT) return false;
  else home.pins = [...home.pins, id];
  write(PINS_KEY, JSON.stringify(home.pins));
  return true;
}
