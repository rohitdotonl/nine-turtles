// The keyboard shortcuts (SPEC.md section 19). This file
// only decides what a key press means; the screens carry it out.
//
// One table, SHORTCUTS, says every shortcut once: what the cheat sheet calls
// it, which group it sits in, and each of its keys with the action that key
// does (decision 0103). The key reader and the `?` cheat sheet are both made
// from it, so a key can't work without being listed, or be listed without
// working. Tooltips and menus read their keys from it too. The keys are the
// same for every reader: choosing keys of your own (decision 0110) was
// removed in step 5 of the owner's review.
import { inSidebar, paneTo } from "./panes";
import type { View } from "./router";

/** A Mac (or iPhone, iPad) names the Command key; every other computer, Ctrl. */
export const onMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export type Action =
  | { kind: "cheat-sheet" }
  | { kind: "toggle-both" }
  | { kind: "escape" }
  | { kind: "add-feed" }
  | { kind: "search" }
  | { kind: "go"; view: View }
  /** A place by its address: Settings. */
  | { kind: "go-to"; path: string }
  | { kind: "move"; step: 1 | -1 }
  /** Home and End: the first (-1) or last (1) article loaded in the list. */
  | { kind: "move-end"; step: 1 | -1 }
  /** Shift+J and Shift+K: the next or previous row, in the sidebar's order. */
  | { kind: "move-feed"; step: 1 | -1 }
  | { kind: "open" }
  | { kind: "open-original" }
  | { kind: "page"; step: 1 | -1 }
  | { kind: "copy-link" }
  | { kind: "star" }
  | { kind: "write-back" }
  | { kind: "highlight" }
  | { kind: "note" }
  | { kind: "mark-unread" }
  | { kind: "mark-all-read" }
  | { kind: "undo" }
  | { kind: "toggle-folder" }
  /** Their settings, on the page of the person or publication (or Edit folder) whose list this is. */
  | { kind: "edit" }
  /** ← and →: the pane before or after (`panes.ts`). */
  | { kind: "pane"; step: 1 | -1 }
  /** ↑ and ↓ in the sidebar: the row above or below. */
  | { kind: "row"; step: 1 | -1 }
  | { kind: "refresh" }
  | { kind: "about" }
  | { kind: "text-size"; step: 1 | -1 };

export type KeyPress = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /**
   * Shift+Space is a key of its own, and a letter's Shift comes from here, not
   * from `key`: with Caps Lock on, "A" arrives without Shift, and Shift+A as "a".
   */
  shiftKey: boolean;
  /** A word is being composed (Chinese, Japanese and the like): its keys are the typing's. */
  isComposing?: boolean;
  target: EventTarget | null;
};

/**
 * The cheat sheet's groups, by what you're doing at the time (decision 0062):
 * reading comes first, as it's what nine turtles is for. Within a group, the
 * key that matters most comes first (decision 0180). "Anywhere" holds only `?`,
 * which the list doesn't print: whoever reads the list has already found it; the Keys button's tooltip names it.
 */
export const GO_TO = "Go to: press G, then…";
export const SHORTCUT_GROUPS = ["Reading", GO_TO, "Getting around", "Tidying up", "Anywhere"] as const;
export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

/**
 * One key of a shortcut: its name ("star"), the key as the cheat sheet
 * prints it ("j", "Shift+A", "Space", "g then u"), and what it does.
 */
export type Binding = { id: string; key: string; does: Action };

/** A key that isn't printed: `=` is the + key without Shift; Home and End are keys everyone already expects, so they need no row. */
type Unlisted = { key: string; does: Action };

export type Shortcut = {
  /** What it does, in the cheat sheet's words. */
  action: string;
  group: ShortcutGroup;
  /** Its keys, as the cheat sheet prints them, in order. */
  keys: string[];
  /** Each of its keys, with what it does. */
  bindings: readonly Binding[];
  /** Its keys all do the same thing, so the cheat sheet says "or" between them ("U or Command Z"), not "/". */
  either: boolean;
  unlisted: readonly Unlisted[];
};

type Entry = [id: string, key: string, does: Action];

function shortcut(group: ShortcutGroup, action: string, entries: Entry[], unlisted: Unlisted[] = []): Shortcut {
  const bindings = entries.map(([id, key, does]) => ({ id, key, does }));
  const either = entries.length > 1 && entries.every(([, , does]) => JSON.stringify(does) === JSON.stringify(entries[0]![2]));
  return { action, group, keys: entries.map(([, key]) => key), bindings, unlisted, either };
}

/** Every shortcut, in the cheat sheet's order. */
export const SHORTCUTS: Shortcut[] = [
  shortcut(
    "Reading",
    "Next / previous article",
    [
      ["next-article", "j", { kind: "move", step: 1 }],
      ["previous-article", "k", { kind: "move", step: -1 }],
    ],
    [
      { key: "Home", does: { kind: "move-end", step: -1 } },
      { key: "End", does: { kind: "move-end", step: 1 } },
    ],
  ),
  shortcut("Reading", "Write back", [["write-back", "w", { kind: "write-back" }]]),
  shortcut("Reading", "Open article", [["open-enter", "Enter", { kind: "open" }]]),
  shortcut("Reading", "Star / unstar", [["star", "s", { kind: "star" }]]),
  shortcut("Reading", "Highlight chosen words", [["highlight", "h", { kind: "highlight" }]]),
  shortcut("Reading", "Add a note", [["note", "n", { kind: "note" }]]),
  shortcut("Reading", "View original", [["open-original", "v", { kind: "open-original" }]]),
  shortcut("Reading", "Scroll down / up a screen", [
    ["page-down", "Space", { kind: "page", step: 1 }],
    ["page-up", "Shift+Space", { kind: "page", step: -1 }],
  ]),
  shortcut(
    "Reading",
    "Text size",
    [
      ["text-larger", "+", { kind: "text-size", step: 1 }],
      ["text-smaller", "-", { kind: "text-size", step: -1 }],
    ],
    [{ key: "=", does: { kind: "text-size", step: 1 } }],
  ),
  shortcut("Reading", "Copy link", [["copy-link", "c", { kind: "copy-link" }]]),
  shortcut("Reading", "Back / close", [["escape", "Esc", { kind: "escape" }]]),
  shortcut(GO_TO, "Unread", [["go-unread", "g then u", { kind: "go", view: "unread" }]]),
  shortcut(GO_TO, "Starred", [["go-starred", "g then s", { kind: "go", view: "starred" }]]),
  shortcut(GO_TO, "Notes", [["go-notes", "g then n", { kind: "go", view: "notes" }]]),
  shortcut(GO_TO, "All articles", [["go-all", "g then a", { kind: "go", view: "all" }]]),
  shortcut(GO_TO, "Settings", [["go-settings", "g then ,", { kind: "go-to", path: "/settings" }]]),
  shortcut("Getting around", "Search", [["search", "/", { kind: "search" }]]),
  shortcut("Getting around", "Next / previous in the sidebar", [
    ["next-feed", "Shift+J", { kind: "move-feed", step: 1 }],
    ["previous-feed", "Shift+K", { kind: "move-feed", step: -1 }],
  ]),
  shortcut(
    "Getting around",
    "Move between panes",
    [
      ["pane-left", "←", { kind: "pane", step: -1 }],
      ["pane-right", "→", { kind: "pane", step: 1 }],
    ],
    [
      { key: "ArrowDown", does: { kind: "row", step: 1 } },
      { key: "ArrowUp", does: { kind: "row", step: -1 } },
    ],
  ),
  shortcut("Getting around", "Their settings", [["edit", "e", { kind: "edit" }]]),
  shortcut("Getting around", "Open / close this folder", [["toggle-folder", "o", { kind: "toggle-folder" }]]),
  shortcut("Getting around", "Info about this person", [["about", "i", { kind: "about" }]]),
  shortcut("Getting around", "Full-screen reading", [["toggle-both", "f", { kind: "toggle-both" }]]),
  shortcut("Getting around", "Add a person or publication", [["add-feed", "a", { kind: "add-feed" }]]),
  shortcut("Tidying up", "Mark all as read", [["mark-all-read", "Shift+A", { kind: "mark-all-read" }]]),
  shortcut("Tidying up", "Mark unread", [["mark-unread", "m", { kind: "mark-unread" }]]),
  // Command Z (Ctrl Z off a Mac) as well as U: the undo every app has (decision 0231).
  shortcut("Tidying up", "Undo", [
    ["undo", "u", { kind: "undo" }],
    ["undo-mod", "Mod+Z", { kind: "undo" }],
  ]),
  shortcut("Tidying up", "Refresh (show new articles)", [["refresh", "r", { kind: "refresh" }]]),
  shortcut("Anywhere", "This list of shortcuts", [["cheat-sheet", "?", { kind: "cheat-sheet" }]]),
];

const BINDINGS = new Map(SHORTCUTS.flatMap((each) => each.bindings.map((binding) => [binding.id, binding] as const)));

/** The key a menu or tooltip shows for an action: `keyFor("star")` is "s". */
export function keyFor(kind: Action["kind"]): string | undefined {
  for (const each of SHORTCUTS) for (const binding of each.bindings) if (binding.does.kind === kind) return binding.key;
  return undefined;
}

/** A tooltip naming every key that does `kind`: "Undo (U or Command Z)". */
export function tipEvery(label: string, kind: Action["kind"]): string {
  const keys = SHORTCUTS.flatMap((each) => each.bindings).filter((binding) => binding.does.kind === kind).map((binding) => keyCap(binding.key));
  return keys.length > 0 ? `${label} (${keys.join(" or ")})` : label;
}

/** The key of one binding, by its name ("text-smaller"). */
export function keyOf(id: string): string | undefined {
  return BINDINGS.get(id)?.key;
}

/** A button's tooltip with its key: "Star (S)". */
export function tip(label: string, id: string): string {
  return withKey(label, keyOf(id));
}

/**
 * The name a printed key has in a key press: "Shift+A" is "A" (the browser
 * says the capital), "Esc" is "Escape", "Space" is " ", and Shift+Space,
 * whose key is " " too, is told apart by Shift.
 */
export function pressName(key: string): string {
  if (key === "Esc") return "Escape";
  if (key === "Space") return " ";
  if (key === "Shift+Space") return "Shift+ ";
  if (key === "←") return "ArrowLeft";
  if (key === "→") return "ArrowRight";
  const shifted = /^Shift\+([a-z])$/i.exec(key);
  if (shifted) return shifted[1]!.toUpperCase();
  const mod = /^Mod\+([a-z])$/i.exec(key);
  if (mod) return `Mod+${mod[1]!.toLowerCase()}`;
  return key;
}

function nameOf(press: KeyPress): string {
  // Command (or Ctrl) with a letter, and nothing else held: "Mod+z".
  if (press.ctrlKey !== press.metaKey) return !press.shiftKey && /^[a-z]$/i.test(press.key) ? `Mod+${press.key.toLowerCase()}` : "";
  if (press.key === " " && press.shiftKey) return "Shift+ ";
  // Caps Lock changes a letter's case, but not which key it is.
  if (/^[a-z]$/i.test(press.key)) return press.shiftKey ? press.key.toUpperCase() : press.key.toLowerCase();
  return press.key;
}

type Tables = { single: Map<string, Action>; sequences: Map<string, Map<string, Action>> };

/** Every key nine turtles answers, by its name in a key press; two-press keys under their first press. */
function makeTables(): Tables {
  const single = new Map<string, Action>();
  const sequences = new Map<string, Map<string, Action>>();
  for (const each of SHORTCUTS) {
    for (const { key, does } of [...each.bindings, ...each.unlisted]) {
      const presses = key.split(" then ");
      if (presses.length === 2) {
        const [first, second] = presses.map(pressName) as [string, string];
        const after = sequences.get(first) ?? new Map<string, Action>();
        after.set(second, does);
        sequences.set(first, after);
      } else single.set(pressName(key), does);
    }
  }
  return { single, sequences };
}

/** How long after `g` the second key still counts, in milliseconds. */
export const SEQUENCE_MS = 1500;

const TABLES = makeTables();

/**
 * Remembers a pending `g` between key presses. `now` is passed in so tests
 * don't depend on the clock.
 */
export function createKeyReader() {
  let pending: { first: string; since: number } | undefined;

  return function read(press: KeyPress, now: number): Action | undefined {
    if (press.isComposing) return undefined;
    const { single, sequences } = TABLES;
    // Escape always works, even in a field: it's how you leave one.
    if (press.key === "Escape") {
      pending = undefined;
      return single.get("Escape");
    }
    // Shortcuts never fire while typing, or alongside the browser's own keys:
    // with Command or Ctrl held, only the table's own (Command Z) count.
    if (isTyping(press.target) || press.altKey || (press.ctrlKey && press.metaKey)) return undefined;
    if (press.ctrlKey || press.metaKey) {
      pending = undefined;
      const name = nameOf(press);
      return name.startsWith("Mod+") ? single.get(name) : undefined;
    }

    if (pending !== undefined && now - pending.since <= SEQUENCE_MS) {
      const after = sequences.get(pending.first);
      pending = undefined;
      return after?.get(nameOf(press));
    }
    pending = undefined;

    const name = nameOf(press);
    if (sequences.has(name)) {
      pending = { first: name, since: now };
      return undefined;
    }
    // On a button or a link, Enter does what that button or link does.
    if (name === "Enter" && isControl(press.target)) return undefined;
    // Space stays with a control that takes it: a button, a tick box, a field.
    if ((name === " " || name === "Shift+ ") && takesSpace(press.target)) return undefined;
    // Home and End stay with a control that moves by them: a menu, a row of choices, a list that scrolls.
    if ((name === "Home" || name === "End") && takesHome(press.target)) return undefined;
    // ← and → stay with what moves by them: a field, a menu, a row of choices, the podcast player.
    // Where there's no pane that way (at either end, or on a phone), they stay the browser's.
    if ((name === "ArrowLeft" || name === "ArrowRight") && (takesArrows(press.target) || (typeof document !== "undefined" && !paneTo(name === "ArrowRight" ? 1 : -1)))) return undefined;
    // ↑ and ↓ are nine turtles' only in the sidebar: the list moves by them itself, and the article scrolls.
    if ((name === "ArrowUp" || name === "ArrowDown") && (!inSidebar(press.target) || takesArrows(press.target))) return undefined;
    return single.get(name);
  };
}

function isControl(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  return target.closest("a[href], button, input, select, textarea, summary, [contenteditable]") !== null;
}

/**
 * Whether Space belongs to what has the keyboard's place: a button, a tick
 * box, a menu item and the like press with Space. A link doesn't, and nor
 * does an article's row in the list (`data-space-reads`): pressing it again
 * would only show the same article, so there Space scrolls the article too.
 */
function takesSpace(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (target.closest("[data-space-reads]")) return false;
  return (
    target.closest(
      "button, input, select, textarea, summary, [contenteditable], iframe, [role='button'], [role='checkbox'], [role='radio'], [role='switch'], [role^='menuitem'], [role='tab'], [role='option'], [role='slider']",
    ) !== null
  );
}

/** Whether Home and End belong to what has the keyboard's place: a row of choices, a menu, a slider or a field. */
function takesHome(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  return target.closest("input, select, textarea, [contenteditable], iframe, [role^='menuitem'], [role='tab'], [role='option'], [role='slider'], [role='radio']") !== null;
}

/**
 * Whether the arrow keys belong to what has the keyboard's place: a field, a
 * menu, a row of choices, a slider, the podcast player (and its bar), the
 * pane's resizer, or something in the article wider than the page, such as a
 * code block or a table, which ← and → scroll sideways.
 */
function takesArrows(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (
    target.closest(
      "input, select, textarea, [contenteditable], iframe, audio, video, [role^='menu'], [role='tab'], [role='option'], [role='listbox'], [role='slider'], [role='radio'], [role='radiogroup'], [role='separator'], [aria-label='Episode player'], [aria-label='Now playing']",
    ) !== null
  )
    return true;
  const article = target.closest(".reading-scroller");
  for (let at: HTMLElement | null = article ? target : null; at && at !== article; at = at.parentElement) {
    if (at.scrollWidth > at.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(at).overflowX)) return true;
  }
  return false;
}

function isTyping(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["checkbox", "radio", "button", "submit", "reset"].includes(target.type);
  }
  return false;
}

/**
 * What has no use with Unread off (SPEC section 10): there's no Unread view,
 * and no read state to mark.
 */
const NEEDS_UNREAD: Action["kind"][] = ["mark-all-read"];

/** Whether a shortcut does nothing with Unread off. */
function needsUnread(each: Shortcut): boolean {
  return each.bindings.some(({ does }) => NEEDS_UNREAD.includes(does.kind) || (does.kind === "go" && does.view === "unread"));
}

/** The shortcuts the cheat sheet lists: those that work in this reading mode (one thing at a time, the owner's trial, has no full-screen reading: decision 0269). */
export function shortcutsFor(unreadOff: boolean, oneThing = false): Shortcut[] {
  return SHORTCUTS.filter((each) => !(unreadOff && needsUnread(each)) && !(oneThing && each.bindings.some(({ does }) => does.kind === "toggle-both")));
}

/**
 * A key as nine turtles prints it, the same on every computer (decision 0180):
 * a letter in capitals, Shift as the word ("Shift+A" is "Shift A", which is
 * what screen readers hear too), and the - key as a true minus sign (U+2212).
 * The key pressed stays the same.
 */
export function keyCap(press: string): string {
  if (press === "-") return "−";
  const mod = /^Mod\+(.)$/.exec(press);
  if (mod) return `${onMac ? "Command" : "Ctrl"} ${mod[1]!.toUpperCase()}`;
  const shifted = /^Shift\+(Space|.)$/.exec(press);
  if (shifted) return `Shift ${shifted[1] === "Space" ? "Space" : shifted[1]!.toUpperCase()}`;
  if (/^[a-z]$/.test(press)) return press.toUpperCase();
  return press;
}

/**
 * A button's tooltip with its key, as SPEC section 19 has it (decision
 * 0064): "Star (S)", "Mark all as read (Shift A)";
 * with no key, the name alone.
 */
export function withKey(label: string, key: string | undefined): string {
  if (!key) return label;
  return `${label} (${keyCap(key)})`;
}
