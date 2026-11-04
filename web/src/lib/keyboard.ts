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
import type { View } from "./router";

export type Action =
  | { kind: "cheat-sheet" }
  | { kind: "toggle-sidebar" }
  | { kind: "toggle-list" }
  | { kind: "toggle-both" }
  | { kind: "escape" }
  | { kind: "add-feed" }
  | { kind: "search" }
  | { kind: "go"; view: View }
  /** A place by its address: Recently read, Your feeds, Settings. */
  | { kind: "go-to"; path: string }
  | { kind: "move"; step: 1 | -1 }
  | { kind: "move-unread"; step: 1 | -1 }
  /** Home and End: the first (-1) or last (1) article loaded in the list. */
  | { kind: "move-end"; step: 1 | -1 }
  /** Shift+J and Shift+K: the next or previous feed, in the sidebar's order. */
  | { kind: "move-feed"; step: 1 | -1 }
  | { kind: "open" }
  | { kind: "open-original" }
  | { kind: "page"; step: 1 | -1 }
  | { kind: "copy-link" }
  | { kind: "star" }
  | { kind: "collect" }
  | { kind: "write-back" }
  | { kind: "highlight" }
  | { kind: "note" }
  | { kind: "mark-unread" }
  | { kind: "mark-all-read" }
  | { kind: "undo" }
  | { kind: "refresh" }
  | { kind: "toggle-folder" }
  | { kind: "edit-place" }
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
 * reading comes first, as it's what nine turtles is for.
 */
export const SHORTCUT_GROUPS = ["Reading", "Getting around", "Tidying up", "Anywhere"] as const;
export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

/**
 * One key of a shortcut: its name ("star"), the key as the cheat sheet
 * prints it ("j", "Shift+A", "Space", "g then u"), and what it does.
 */
export type Binding = { id: string; key: string; does: Action };

/** A key that does the same as another and isn't printed (`=` is the + key without Shift). */
type Unlisted = { key: string; does: Action };

export type Shortcut = {
  /** What it does, in the cheat sheet's words. */
  action: string;
  group: ShortcutGroup;
  /** Its keys, as the cheat sheet prints them, in order. */
  keys: string[];
  /** Each of its keys, with what it does. */
  bindings: readonly Binding[];
  unlisted: readonly Unlisted[];
};

type Entry = [id: string, key: string, does: Action];

function shortcut(group: ShortcutGroup, action: string, entries: Entry[], unlisted: Unlisted[] = []): Shortcut {
  const bindings = entries.map(([id, key, does]) => ({ id, key, does }));
  return { action, group, keys: entries.map(([, key]) => key), bindings, unlisted };
}

/** Every shortcut, in the cheat sheet's order. */
export const SHORTCUTS: Shortcut[] = [
  shortcut("Reading", "Next / previous article", [
    ["next-article", "j", { kind: "move", step: 1 }],
    ["previous-article", "k", { kind: "move", step: -1 }],
  ]),
  shortcut("Reading", "Next / previous unread article", [
    ["next-unread", "n", { kind: "move-unread", step: 1 }],
    ["previous-unread", "Shift+N", { kind: "move-unread", step: -1 }],
  ]),
  shortcut("Reading", "First / last article in the list", [
    ["first-article", "Home", { kind: "move-end", step: -1 }],
    ["last-article", "End", { kind: "move-end", step: 1 }],
  ]),
  shortcut("Reading", "Open article", [
    ["open-enter", "Enter", { kind: "open" }],
    ["open", "o", { kind: "open" }],
  ]),
  shortcut("Reading", "Scroll down / up a screen", [
    ["page-down", "Space", { kind: "page", step: 1 }],
    ["page-up", "Shift+Space", { kind: "page", step: -1 }],
  ]),
  shortcut("Reading", "Open original", [["open-original", "v", { kind: "open-original" }]]),
  shortcut("Reading", "Copy the article's link", [["copy-link", "c", { kind: "copy-link" }]]),
  shortcut(
    "Reading",
    "Text size",
    [
      ["text-larger", "+", { kind: "text-size", step: 1 }],
      ["text-smaller", "-", { kind: "text-size", step: -1 }],
    ],
    [{ key: "=", does: { kind: "text-size", step: 1 } }],
  ),
  shortcut("Reading", "Star / unstar", [["star", "s", { kind: "star" }]]),
  shortcut("Reading", "Add to collection", [["collect", "l", { kind: "collect" }]]),
  shortcut("Reading", "Write back", [["write-back", "w", { kind: "write-back" }]]),
  shortcut("Reading", "Highlight the words chosen / write a note", [
    ["highlight", "h", { kind: "highlight" }],
    ["note", "Shift+H", { kind: "note" }],
  ]),
  shortcut("Reading", "Back / close", [["escape", "Esc", { kind: "escape" }]]),
  shortcut("Getting around", "Go to Unread", [["go-unread", "g then u", { kind: "go", view: "unread" }]]),
  shortcut("Getting around", "Go to Starred", [["go-starred", "g then s", { kind: "go", view: "starred" }]]),
  shortcut("Getting around", "Go to All", [["go-all", "g then a", { kind: "go", view: "all" }]]),
  shortcut("Getting around", "Go to Recently read", [["go-recent", "g then r", { kind: "go-to", path: "/recent" }]]),
  shortcut("Getting around", "Go to Your feeds", [["go-feeds", "g then f", { kind: "go-to", path: "/settings/feeds" }]]),
  shortcut("Getting around", "Go to Settings", [["go-settings", "g then ,", { kind: "go-to", path: "/settings" }]]),
  shortcut("Getting around", "Next / previous in the sidebar", [
    ["next-feed", "Shift+J", { kind: "move-feed", step: 1 }],
    ["previous-feed", "Shift+K", { kind: "move-feed", step: -1 }],
  ]),
  shortcut("Getting around", "About this person or publication", [["about", "i", { kind: "about" }]]),
  shortcut("Getting around", "Search", [["search", "/", { kind: "search" }]]),
  shortcut("Getting around", "Show / hide sidebar", [["toggle-sidebar", "[", { kind: "toggle-sidebar" }]]),
  shortcut("Getting around", "Show / hide article list", [["toggle-list", "]", { kind: "toggle-list" }]]),
  shortcut("Getting around", "Full-screen reading (hide sidebar and list)", [["toggle-both", "\\", { kind: "toggle-both" }]]),
  shortcut("Getting around", "Fold / unfold this folder", [["toggle-folder", "e", { kind: "toggle-folder" }]]),
  shortcut("Tidying up", "Mark unread", [["mark-unread", "m", { kind: "mark-unread" }]]),
  shortcut("Tidying up", "Mark all as read", [["mark-all-read", "Shift+A", { kind: "mark-all-read" }]]),
  shortcut("Tidying up", "Undo", [["undo", "u", { kind: "undo" }]]),
  shortcut("Tidying up", "Show new articles", [["refresh", "r", { kind: "refresh" }]]),
  shortcut("Tidying up", "Edit this person, publication or folder", [["edit-place", "Shift+E", { kind: "edit-place" }]]),
  shortcut("Anywhere", "Add a person or publication", [["add-feed", "a", { kind: "add-feed" }]]),
  shortcut("Anywhere", "This list of shortcuts", [["cheat-sheet", "?", { kind: "cheat-sheet" }]]),
];

const BINDINGS = new Map(SHORTCUTS.flatMap((each) => each.bindings.map((binding) => [binding.id, binding] as const)));

/** The key a menu or tooltip shows for an action: `keyFor("star")` is "s". */
export function keyFor(kind: Action["kind"]): string | undefined {
  for (const each of SHORTCUTS) for (const binding of each.bindings) if (binding.does.kind === kind) return binding.key;
  return undefined;
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
  const shifted = /^Shift\+([a-z])$/i.exec(key);
  if (shifted) return shifted[1]!.toUpperCase();
  return key;
}

function nameOf(press: KeyPress): string {
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
    // Shortcuts never fire while typing, or alongside the browser's own keys.
    if (isTyping(press.target) || press.ctrlKey || press.metaKey || press.altKey) return undefined;

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
 * and no read state to mark or move by.
 */
const NEEDS_UNREAD: Action["kind"][] = ["mark-all-read", "move-unread"];

/** Whether a shortcut does nothing with Unread off. */
function needsUnread(each: Shortcut): boolean {
  return each.bindings.some(({ does }) => NEEDS_UNREAD.includes(does.kind) || (does.kind === "go" && does.view === "unread"));
}

/** The shortcuts the cheat sheet lists: those that work in this reading mode. */
export function shortcutsFor(unreadOff: boolean): Shortcut[] {
  return SHORTCUTS.filter((each) => !(unreadOff && needsUnread(each)));
}

/**
 * Whether a shortcut fits what was typed in the list's find field: its
 * words contain it ("star"), or one of its keys is it ("s", "g u", "shift a").
 */
export function shortcutMatches(shortcut: { keys: string[]; action: string }, typed: string): boolean {
  const wanted = typed.trim().toLowerCase().replace(/\s+/g, " ");
  if (wanted === "") return true;
  if (shortcut.action.toLowerCase().includes(wanted)) return true;
  return shortcut.keys.some((key) => {
    const spelled = key.toLowerCase();
    const forms = [spelled, spelled.replace(" then ", " "), spelled.replace("shift+", "shift "), spelled.replace("shift+", "⇧")];
    return forms.includes(wanted);
  });
}

/**
 * What a key's cap shows, as macOS and Apple Books print keys (decision 0055):
 * a letter in capitals, Shift as ⇧ ("Shift+A" shows ⇧A) and the - key as a
 * true minus sign (U+2212). `spoken` is what screen readers hear instead,
 * when the cap's symbol wouldn't read well ("Shift A"). The key pressed
 * stays the same.
 */
export function keyCap(press: string): { cap: string; spoken?: string } {
  if (press === "-") return { cap: "−" };
  const shifted = /^Shift\+(Space|.)$/.exec(press);
  if (shifted) {
    const key = shifted[1] === "Space" ? "Space" : shifted[1]!.toUpperCase();
    return { cap: `⇧${key}`, spoken: `Shift ${key}` };
  }
  if (/^[a-z]$/.test(press)) return { cap: press.toUpperCase() };
  return { cap: press };
}

/**
 * A button's tooltip with its key, as SPEC section 19 has it (decision
 * 0064): "Star (S)", "Hide the sidebar ( [ )"; with no key, the name alone.
 */
export function withKey(label: string, key: string | undefined): string {
  if (!key) return label;
  const cap = keyCap(key).cap;
  return /^[[\]\\]$/.test(cap) ? `${label} ( ${cap} )` : `${label} (${cap})`;
}
