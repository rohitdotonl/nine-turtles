// Home redesign, design round only (thread "Redesign Home for clarity"): which of the two versions shows, and
// who is pinned. Both live on this device for now, so Rohit can try them; the version chosen is built properly
// (pins kept on the server, per reader) before anything ships.

export type HomeStyle = "now" | `v${number}`;

/** What each version changes (thread "Redesign Home for clarity": ten versions, from closest to today to wildest). */
export type Look = {
  /** Section headings: shown, hidden (screen readers still hear them), or small quiet words (v9). */
  headings: "shown" | "hidden" | "quiet";
  /** A person's or publication's mark in the icon column. */
  mark: "blank" | "initial" | "glyph" | "none" | "bare";
  /** How one group is parted from the next. */
  parts: "space" | "hairline" | "cards" | "cards-out" | "row-cards";
  /** Hairlines between the rows inside a card. */
  sep: boolean;
  /** Unread and All articles as two tiles side by side. */
  topPair: boolean;
  /** A folder tile shows the first few faces of who's in it. */
  folderFaces: boolean;
  /** The people in no folder as faces too. */
  looseFaces: boolean;
  /** Each folder its own card: its name as the card's heading above it, or as the card's first row. */
  folderCards: "no" | "under" | "inside";
  /** A folder's people as faces. */
  folderGrid: boolean;
  /** Headings large, in the titles' serif, as a magazine's sections. */
  bigHeads: boolean;
  /** A folder icon on the Folders heading (and a sign on the other headings), none on each folder's row. */
  headIcons: "no" | "folders" | "all";
  /** Folder names in semibold, so they read as the names of groups. */
  folderBold: boolean;
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

const base: Look = { headings: "hidden", mark: "initial", parts: "space", shut: false, faces: false, pair: false, tiles: false, serif: false, editTop: true, sep: false, topPair: false, folderFaces: false, looseFaces: false, folderCards: "no", folderGrid: false, bigHeads: false, headIcons: "no", folderBold: false };
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
  // Round two (Rohit: "4, 5 and 8 are quite easy to my eyes"): ten around cards.
  c1: { ...base, headings: "shown", parts: "cards-out", editTop: false },
  c2: { ...base, parts: "cards-out" },
  c3: { ...base, parts: "cards-out", shut: true },
  c4: { ...base, headings: "shown", parts: "cards-out", sep: true, editTop: false },
  c5: { ...base, parts: "cards-out", sep: true, shut: true },
  c6: { ...base, parts: "cards-out", sep: true, shut: true, faces: true, pair: true },
  c7: { ...base, parts: "cards-out", sep: true, shut: true, faces: true, pair: true, tiles: true },
  c8: { ...base, parts: "row-cards", shut: true, faces: true },
  c9: { ...base, parts: "cards-out", sep: true, shut: true, faces: true, pair: true, tiles: true, topPair: true },
  c10: { ...base, parts: "cards-out", shut: true, faces: true, pair: true, tiles: true, topPair: true, folderFaces: true, looseFaces: true },
  // Round three (Rohit: "I like 1 and 2"; no fixed rules, folders open): ten growing out of c1 and c2.
  d1: { ...base, headings: "shown", parts: "cards-out", mark: "bare", editTop: false },
  d2: { ...base, parts: "cards-out", mark: "bare" },
  d3: { ...base, headings: "shown", parts: "cards-out", mark: "bare", sep: true, editTop: false },
  d4: { ...base, headings: "shown", parts: "cards-out", mark: "bare", folderCards: "under", editTop: false },
  d5: { ...base, parts: "cards-out", mark: "bare", folderCards: "inside", sep: true },
  d6: { ...base, headings: "shown", parts: "cards-out", mark: "bare", folderCards: "under", topPair: true, pair: true, editTop: false },
  d7: { ...base, headings: "shown", parts: "cards-out", mark: "bare", folderCards: "under", faces: true, editTop: false },
  d8: { ...base, headings: "shown", parts: "cards-out", mark: "bare", folderCards: "under", faces: true, topPair: true, pair: true, editTop: false },
  d9: { ...base, headings: "shown", parts: "cards-out", folderCards: "under", faces: true, folderGrid: true, looseFaces: true, topPair: true, pair: true, editTop: false },
  // Round four (Rohit: no faces, nothing two lines tall; 1 with the folder icon on "Folders" only).
  e1: { ...base, headings: "shown", parts: "cards-out", mark: "bare", headIcons: "folders", editTop: false },
  e2: { ...base, headings: "shown", parts: "cards-out", mark: "bare", headIcons: "folders", folderBold: true, editTop: false },
  e3: { ...base, headings: "shown", parts: "cards-out", mark: "bare", headIcons: "folders", folderBold: true, sep: true, editTop: false },
  e4: { ...base, headings: "shown", parts: "cards-out", mark: "bare", headIcons: "folders", folderCards: "under", editTop: false },
  e5: { ...base, headings: "shown", parts: "cards-out", mark: "bare", headIcons: "folders", folderCards: "inside", sep: true, editTop: false },
  e6: { ...base, headings: "shown", parts: "cards-out", mark: "bare", headIcons: "all", folderBold: true, editTop: false },
  e7: { ...base, headings: "shown", parts: "cards", mark: "bare", headIcons: "all", folderBold: true, editTop: false },
  e8: { ...base, headings: "shown", parts: "cards-out", mark: "bare", headIcons: "folders", folderCards: "under", bigHeads: true, editTop: false },
  e9: { ...base, headings: "shown", parts: "cards-out", mark: "bare", headIcons: "all", folderCards: "under", sep: true, bigHeads: true, editTop: false },
  e10: { ...base, headings: "shown", parts: "row-cards", mark: "bare", headIcons: "all", folderBold: true, editTop: false },
  d10: { ...base, headings: "shown", parts: "cards-out", folderCards: "under", faces: true, folderGrid: true, looseFaces: true, topPair: true, pair: true, bigHeads: true, editTop: false },
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
