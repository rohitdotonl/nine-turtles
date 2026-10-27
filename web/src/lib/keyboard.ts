// The keyboard shortcuts (SPEC.md section 19). This file
// only decides what a key press means; the screens carry it out.
//
// One table, SHORTCUTS, says every shortcut once: what the cheat sheet calls
// it, which group it sits in, and each of its keys with the action that key
// does (decision 0103). The key reader and the `?` cheat sheet are both made
// from it, so a key can't work without being listed, or be listed without
// working. A later change may let keys be chosen; the table is the defaults.
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
  | { kind: "move"; step: 1 | -1 }
  | { kind: "move-unread"; step: 1 | -1 }
  | { kind: "open" }
  | { kind: "open-original" }
  | { kind: "page"; step: 1 | -1 }
  | { kind: "copy-link" }
  | { kind: "star" }
  | { kind: "mark-unread" }
  | { kind: "mark-all-read" }
  | { kind: "mark-older-read" }
  | { kind: "undo" }
  | { kind: "refresh" }
  | { kind: "toggle-folder" }
  | { kind: "edit-place" }
  | { kind: "text-size"; step: 1 | -1 };

export type KeyPress = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** Only Space needs it: Shift+Space is a key of its own (Shift with a letter shows in `key`, "A"). */
  shiftKey?: boolean;
  target: EventTarget | null;
};

/**
 * The cheat sheet's groups, by what you're doing at the time (decision 0062):
 * reading comes first, as it's what nine turtles is for.
 */
export const SHORTCUT_GROUPS = ["Reading", "Getting around", "Tidying up", "Anywhere"] as const;
export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

/** A key, as the cheat sheet prints it ("j", "Shift+A", "Space", "g then u"), and what it does. */
type Binding = readonly [key: string, does: Action];

export type Shortcut = {
  /** What it does, in the cheat sheet's words. */
  action: string;
  group: ShortcutGroup;
  /** Its keys, as the cheat sheet prints them, in order. */
  keys: string[];
  /** What each key does. */
  bindings: readonly Binding[];
  /** Keys that do the same and aren't printed: `=` is the + key without Shift. */
  unlisted: readonly Binding[];
  /** Whether it works today. One that doesn't yet isn't listed, and its keys do nothing. */
  ready: boolean;
};

function shortcut(group: ShortcutGroup, action: string, bindings: Binding[], unlisted: Binding[] = []): Shortcut {
  return { action, group, keys: bindings.map(([key]) => key), bindings, unlisted, ready: true };
}

/** A shortcut DESIGN.md names whose feature doesn't exist yet: kept for when it does, never listed. */
function planned(group: ShortcutGroup, action: string, keys: string[]): Shortcut {
  return { action, group, keys, bindings: [], unlisted: [], ready: false };
}

/** Every shortcut, in the cheat sheet's order. */
export const SHORTCUTS: Shortcut[] = [
  shortcut("Reading", "Next / previous article", [
    ["j", { kind: "move", step: 1 }],
    ["k", { kind: "move", step: -1 }],
  ]),
  shortcut("Reading", "Next / previous unread article", [
    ["n", { kind: "move-unread", step: 1 }],
    ["Shift+N", { kind: "move-unread", step: -1 }],
  ]),
  shortcut("Reading", "Open article", [
    ["Enter", { kind: "open" }],
    ["o", { kind: "open" }],
  ]),
  shortcut("Reading", "Scroll down / up a screen", [
    ["Space", { kind: "page", step: 1 }],
    ["Shift+Space", { kind: "page", step: -1 }],
  ]),
  shortcut("Reading", "Open original", [["v", { kind: "open-original" }]]),
  shortcut("Reading", "Copy the article's link", [["c", { kind: "copy-link" }]]),
  shortcut(
    "Reading",
    "Text size",
    [
      ["+", { kind: "text-size", step: 1 }],
      ["-", { kind: "text-size", step: -1 }],
    ],
    [["=", { kind: "text-size", step: 1 }]],
  ),
  shortcut("Reading", "Star / unstar", [["s", { kind: "star" }]]),
  shortcut("Reading", "Back / close", [["Esc", { kind: "escape" }]]),
  shortcut("Getting around", "Go to Unread", [["g then u", { kind: "go", view: "unread" }]]),
  shortcut("Getting around", "Go to Starred", [["g then s", { kind: "go", view: "starred" }]]),
  shortcut("Getting around", "Go to All", [["g then a", { kind: "go", view: "all" }]]),
  planned("Getting around", "Next / previous feed", ["Shift+J", "Shift+K"]),
  shortcut("Getting around", "Search", [["/", { kind: "search" }]]),
  shortcut("Getting around", "Show / hide sidebar", [["[", { kind: "toggle-sidebar" }]]),
  shortcut("Getting around", "Show / hide article list", [["]", { kind: "toggle-list" }]]),
  shortcut("Getting around", "Full-screen reading (hide sidebar and list)", [["\\", { kind: "toggle-both" }]]),
  shortcut("Getting around", "Fold / unfold this folder", [["e", { kind: "toggle-folder" }]]),
  shortcut("Tidying up", "Mark unread", [["m", { kind: "mark-unread" }]]),
  shortcut("Tidying up", "Mark all as read", [["Shift+A", { kind: "mark-all-read" }]]),
  shortcut("Tidying up", "Mark older as read", [["Shift+O", { kind: "mark-older-read" }]]),
  shortcut("Tidying up", "Undo", [["u", { kind: "undo" }]]),
  shortcut("Tidying up", "Show new items", [["r", { kind: "refresh" }]]),
  shortcut("Tidying up", "Edit this feed or folder", [["Shift+E", { kind: "edit-place" }]]),
  shortcut("Anywhere", "Add feed", [["a", { kind: "add-feed" }]]),
  shortcut("Anywhere", "This list of shortcuts", [["?", { kind: "cheat-sheet" }]]),
];

/** The key a menu or tooltip shows for an action, from the table: `keyFor("star")` is "s". */
export function keyFor(kind: Action["kind"]): string {
  for (const each of SHORTCUTS) for (const [key, does] of each.bindings) if (does.kind === kind) return key;
  throw new Error(`No key does ${kind}`);
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
  return press.key === " " && press.shiftKey ? "Shift+ " : press.key;
}

/** Every key the reader answers, by its name in a key press; two-press keys under their first press. */
const SINGLE = new Map<string, Action>();
const SEQUENCES = new Map<string, Map<string, Action>>();
for (const each of SHORTCUTS) {
  if (!each.ready) continue;
  for (const [key, does] of [...each.bindings, ...each.unlisted]) {
    const presses = key.split(" then ");
    if (presses.length === 2) {
      const [first, second] = presses.map(pressName) as [string, string];
      const after = SEQUENCES.get(first) ?? new Map<string, Action>();
      after.set(second, does);
      SEQUENCES.set(first, after);
    } else SINGLE.set(pressName(key), does);
  }
}

/** How long after `g` the second key still counts, in milliseconds. */
export const SEQUENCE_MS = 1500;

/**
 * Remembers a pending `g` between key presses. `now` is passed in so tests
 * don't depend on the clock.
 */
export function createKeyReader() {
  let pending: { first: string; since: number } | undefined;

  return function read(press: KeyPress, now: number): Action | undefined {
    // Escape always works, even in a field: it's how you leave one.
    if (press.key === "Escape") {
      pending = undefined;
      return SINGLE.get("Escape");
    }
    // Shortcuts never fire while typing, or alongside the browser's own keys.
    if (isTyping(press.target) || press.ctrlKey || press.metaKey || press.altKey) return undefined;

    if (pending !== undefined && now - pending.since <= SEQUENCE_MS) {
      const after = SEQUENCES.get(pending.first);
      pending = undefined;
      return after?.get(press.key);
    }
    pending = undefined;

    const name = nameOf(press);
    if (SEQUENCES.has(name)) {
      pending = { first: name, since: now };
      return undefined;
    }
    // On a button or a link, Enter does what that button or link does.
    if (name === "Enter" && isControl(press.target)) return undefined;
    // Space stays with a control that takes it: a button, a tick box, a field.
    if ((name === " " || name === "Shift+ ") && takesSpace(press.target)) return undefined;
    return SINGLE.get(name);
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
 * What river mode has no use for (SPEC section 10): there's no Unread view,
 * and no read state to mark or move by.
 */
const NOT_IN_RIVER: Action["kind"][] = ["mark-all-read", "mark-older-read", "move-unread"];

/** Whether a shortcut does nothing in river mode. */
function notInRiver(each: Shortcut): boolean {
  return each.bindings.some(([, does]) => NOT_IN_RIVER.includes(does.kind) || (does.kind === "go" && does.view === "unread"));
}

/** The shortcuts the cheat sheet lists: those that work today, in this reading mode. */
export function shortcutsFor(river: boolean): Shortcut[] {
  return SHORTCUTS.filter((each) => each.ready && !(river && notInRiver(each)));
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
