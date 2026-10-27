// The keyboard shortcuts (SPEC.md section 19). This file
// only decides what a key press means; the screens carry it out.
//
// One table, SHORTCUTS, says every shortcut once: what the cheat sheet calls
// it, which group it sits in, and each of its keys with the action that key
// does (decision 0103). The key reader and the `?` cheat sheet are both made
// from it, so a key can't work without being listed, or be listed without
// working. The table holds the keys nine turtles starts with; the reader may
// give a key another one, or none (decision 0110). Those choices are a
// KeyMap, and `resolve` lays them over the table, so the key reader, the
// cheat sheet, tooltips and menus all still come from one place.
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
 * One key of a shortcut: its name, kept when the key changes ("star"), the
 * key as the cheat sheet prints it ("j", "Shift+A", "Space", "g then u"; ""
 * once the reader has left it with no key), and what it does. A fixed key
 * can't be changed: Enter, Escape, `?` and the `g then …` keys (decision 0110).
 */
export type Binding = { id: string; key: string; does: Action; fixed: boolean };

/** A key that does the same as another and isn't printed (`=` is the + key without Shift), only while that one keeps its own key. */
type Unlisted = { key: string; does: Action; follows: string };

export type Shortcut = {
  /** What it does, in the cheat sheet's words. */
  action: string;
  group: ShortcutGroup;
  /** Its keys, as the cheat sheet prints them, in order; none once the reader has taken them all away. */
  keys: string[];
  /** Each of its keys, with what it does. */
  bindings: readonly Binding[];
  unlisted: readonly Unlisted[];
  /** Whether it works today. One that doesn't yet isn't listed, and its keys do nothing. */
  ready: boolean;
};

/** Keys that stay as they are and can't be given to anything else (decision 0110). */
const FIXED = ["Enter", "Esc", "?"];

type Entry = [id: string, key: string, does: Action];

function shortcut(group: ShortcutGroup, action: string, entries: Entry[], unlisted: Unlisted[] = []): Shortcut {
  // Two presses (g then u), Enter, Escape and ? stay as they are.
  const bindings = entries.map(([id, key, does]) => ({ id, key, does, fixed: key.includes(" then ") || FIXED.includes(key) }));
  return { action, group, keys: entries.map(([, key]) => key), bindings, unlisted, ready: true };
}

/**
 * A shortcut whose place isn't built yet: its keys are written down, so it
 * works the moment it's made a `shortcut`, but until then it isn't listed
 * and its keys do nothing.
 */
function soon(group: ShortcutGroup, action: string, entries: Entry[]): Shortcut {
  return { ...shortcut(group, action, entries), ready: false };
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
    [{ key: "=", does: { kind: "text-size", step: 1 }, follows: "text-larger" }],
  ),
  shortcut("Reading", "Star / unstar", [["star", "s", { kind: "star" }]]),
  shortcut("Reading", "Add to collection", [["collect", "l", { kind: "collect" }]]),
  shortcut("Reading", "Back / close", [["escape", "Esc", { kind: "escape" }]]),
  shortcut("Getting around", "Go to Unread", [["go-unread", "g then u", { kind: "go", view: "unread" }]]),
  shortcut("Getting around", "Go to Starred", [["go-starred", "g then s", { kind: "go", view: "starred" }]]),
  shortcut("Getting around", "Go to All", [["go-all", "g then a", { kind: "go", view: "all" }]]),
  shortcut("Getting around", "Go to Recently read", [["go-recent", "g then r", { kind: "go-to", path: "/recent" }]]),
  shortcut("Getting around", "Go to Your feeds", [["go-feeds", "g then f", { kind: "go-to", path: "/settings/feeds" }]]),
  shortcut("Getting around", "Go to Settings", [["go-settings", "g then ,", { kind: "go-to", path: "/settings" }]]),
  shortcut("Getting around", "Next / previous feed", [
    ["next-feed", "Shift+J", { kind: "move-feed", step: 1 }],
    ["previous-feed", "Shift+K", { kind: "move-feed", step: -1 }],
  ]),
  shortcut("Getting around", "Search", [["search", "/", { kind: "search" }]]),
  shortcut("Getting around", "Show / hide sidebar", [["toggle-sidebar", "[", { kind: "toggle-sidebar" }]]),
  shortcut("Getting around", "Show / hide article list", [["toggle-list", "]", { kind: "toggle-list" }]]),
  shortcut("Getting around", "Full-screen reading (hide sidebar and list)", [["toggle-both", "\\", { kind: "toggle-both" }]]),
  shortcut("Getting around", "Fold / unfold this folder", [["toggle-folder", "e", { kind: "toggle-folder" }]]),
  shortcut("Tidying up", "Mark unread", [["mark-unread", "m", { kind: "mark-unread" }]]),
  shortcut("Tidying up", "Mark all as read", [["mark-all-read", "Shift+A", { kind: "mark-all-read" }]]),
  shortcut("Tidying up", "Mark older as read", [["mark-older-read", "Shift+O", { kind: "mark-older-read" }]]),
  shortcut("Tidying up", "Undo", [["undo", "u", { kind: "undo" }]]),
  shortcut("Tidying up", "Show new articles", [["refresh", "r", { kind: "refresh" }]]),
  shortcut("Tidying up", "Edit this feed or folder", [["edit-place", "Shift+E", { kind: "edit-place" }]]),
  shortcut("Anywhere", "Add feed", [["add-feed", "a", { kind: "add-feed" }]]),
  shortcut("Anywhere", "This list of shortcuts", [["cheat-sheet", "?", { kind: "cheat-sheet" }]]),
];

/**
 * The keys the reader chose (decision 0110), by binding name: `{ star: "x" }`,
 * or "" for one left with no key. Only changed keys are kept; the rest are
 * the table's. Saved for the reader's account, so they follow them to every device.
 */
export type KeyMap = Record<string, string>;

const BINDINGS = new Map(SHORTCUTS.flatMap((each) => each.bindings.map((binding) => [binding.id, binding] as const)));

/** A binding as nine turtles starts, by its name. */
export function bindingNamed(id: string): Binding | undefined {
  return BINDINGS.get(id);
}

/** The reader's key for a binding: their choice, if it's one that can change, or the table's. */
function chosen(binding: Binding, custom: KeyMap): string {
  if (binding.fixed || !Object.hasOwn(custom, binding.id)) return binding.key;
  return custom[binding.id] ?? binding.key;
}

/** The table with the reader's keys laid over it. */
export function resolve(custom: KeyMap = {}): Shortcut[] {
  const resolved = SHORTCUTS.map((each) => {
    const bindings = each.bindings.map((binding) => ({ ...binding, key: chosen(binding, custom) }));
    return { ...each, bindings, keys: bindings.map((binding) => binding.key).filter((key) => key !== "") };
  });
  // `=` stands in for + only while + is still the + key, and nothing else has been given `=`.
  const taken = new Set(resolved.flatMap((each) => each.keys));
  return resolved.map((each) => ({
    ...each,
    unlisted: each.unlisted.filter((extra) => !taken.has(extra.key) && each.bindings.find((binding) => binding.id === extra.follows)?.key === BINDINGS.get(extra.follows)?.key),
  }));
}

/** The key a menu or tooltip shows for an action, if it has one: `keyFor("star")` is "s". */
export function keyFor(kind: Action["kind"], custom: KeyMap = {}): string | undefined {
  for (const each of resolve(custom)) for (const binding of each.bindings) if (binding.does.kind === kind && binding.key !== "") return binding.key;
  return undefined;
}

/** The key of one binding, by its name ("text-smaller"), if it has one. */
export function keyOf(id: string, custom: KeyMap = {}): string | undefined {
  const binding = BINDINGS.get(id);
  return binding ? chosen(binding, custom) || undefined : undefined;
}

/** Whether the reader has given a binding a key other than its own (or none). */
export function isChanged(id: string, custom: KeyMap): boolean {
  const binding = BINDINGS.get(id);
  return binding !== undefined && chosen(binding, custom) !== binding.key;
}

/**
 * The binding that has a key now, other than `id` itself: the one a new key
 * would be taken from. Fixed keys can't be chosen, so they never come up.
 */
export function holderOf(key: string, custom: KeyMap, id?: string): Binding | undefined {
  for (const each of resolve(custom)) for (const binding of each.bindings) if (binding.key === key && binding.id !== id) return binding;
  return undefined;
}

/**
 * Gives a binding a key: its own again (a reset) or a new one. Whatever had
 * that key is left with none, so one key never does two things; the reader
 * has already been asked (decision 0110). Only keys that differ from the
 * table's are kept.
 */
export function rebind(custom: KeyMap, id: string, key: string): KeyMap {
  const binding = BINDINGS.get(id);
  if (!binding || binding.fixed) return custom;
  const next: KeyMap = { ...custom };
  const holder = holderOf(key, custom, id);
  if (holder) next[holder.id] = "";
  next[id] = key;
  for (const [name, value] of Object.entries(next)) if (BINDINGS.get(name)?.key === value) delete next[name];
  return next;
}

/** Keys pressed on their own that never become a key: Shift, Ctrl and the rest are only held with another. */
const MODIFIERS = ["Shift", "Control", "Alt", "AltGraph", "Meta", "OS", "Super", "Hyper", "CapsLock", "Fn", "FnLock", "NumLock", "ScrollLock", "Symbol", "SymbolLock", "Dead", "Unidentified", "Process"];

/** Keys other than one character that can be chosen: they do nothing else in nine turtles. */
const NAMED = ["Home", "End"];

/**
 * What the next press means while a key is being chosen (decision 0110): a
 * key, as the cheat sheet prints it; a plain sentence saying why that one
 * can't be used; or nothing, for Shift and the like on their own, which
 * keep it waiting. Escape (cancel) and Tab (leave) are the caller's.
 */
export function chooseKey(press: KeyPress): { key: string } | { refused: string } | undefined {
  if (MODIFIERS.includes(press.key)) return undefined;
  if (press.ctrlKey || press.metaKey || press.altKey) return { refused: "Keys held with ⌘, Ctrl or Option belong to the browser. Choose another key." };
  if (press.key === "Enter") return { refused: "Enter presses buttons and opens articles, so it stays as it is. Choose another key." };
  if (press.key === "?") return { refused: "? always opens this list, so it stays as it is. Choose another key." };
  if (press.key === "g") return { refused: "G starts the Go to keys (G then U and the rest), so it can't be used alone. Choose another key." };
  if (press.key === " ") return { key: press.shiftKey ? "Shift+Space" : "Space" };
  if (NAMED.includes(press.key) && !press.shiftKey) return { key: press.key };
  if ([...press.key].length === 1 && press.key.trim() !== "") {
    if (/^[a-z]$/i.test(press.key)) return { key: press.shiftKey ? `Shift+${press.key.toUpperCase()}` : press.key.toLowerCase() };
    return { key: press.key };
  }
  return { refused: "That key can't be used for a shortcut. Choose a letter, a number, a sign, Space, Home or End." };
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

/** Every key the reader answers, by its name in a key press; two-press keys under their first press. */
function tablesFor(custom: KeyMap): Tables {
  const single = new Map<string, Action>();
  const sequences = new Map<string, Map<string, Action>>();
  for (const each of resolve(custom)) {
    if (!each.ready) continue;
    for (const { key, does } of [...each.bindings, ...each.unlisted]) {
      if (key === "") continue;
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

/**
 * Remembers a pending `g` between key presses. `now` is passed in so tests
 * don't depend on the clock; `keys` gives the reader's keys as they are at
 * each press (decision 0110).
 */
export function createKeyReader(keys: () => KeyMap = () => ({})) {
  let pending: { first: string; since: number } | undefined;
  // Made again only when the reader's keys change.
  let made: { from: string; tables: Tables } | undefined;
  const tables = (): Tables => {
    const custom = keys();
    const from = JSON.stringify(custom);
    if (made?.from !== from) made = { from, tables: tablesFor(custom) };
    return made.tables;
  };

  return function read(press: KeyPress, now: number): Action | undefined {
    if (press.isComposing) return undefined;
    const { single, sequences } = tables();
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
 * What river mode has no use for (SPEC section 10): there's no Unread view,
 * and no read state to mark or move by.
 */
const NOT_IN_RIVER: Action["kind"][] = ["mark-all-read", "mark-older-read", "move-unread"];

/** Whether a shortcut does nothing in river mode. */
function notInRiver(each: Shortcut): boolean {
  return each.bindings.some(({ does }) => NOT_IN_RIVER.includes(does.kind) || (does.kind === "go" && does.view === "unread"));
}

/** The shortcuts the cheat sheet lists, with the reader's keys: those that work today, in this reading mode. */
export function shortcutsFor(river: boolean, custom: KeyMap = {}): Shortcut[] {
  return resolve(custom).filter((each) => each.ready && !(river && notInRiver(each)));
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

/** A key in plain words, for a sentence or a screen reader: "Shift+O", "G then U", "S". */
export function keyWords(key: string): string {
  return key
    .split(" then ")
    .map((press) => {
      const cap = keyCap(press);
      return cap.spoken ? cap.spoken.replace(" ", "+") : cap.cap === "−" ? "-" : cap.cap;
    })
    .join(" then ");
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

/** What each key that can change does, as the end of a sentence: "Shift+O already marks older as read." */
const DOES: Record<string, string> = {
  "next-article": "goes to the next article",
  "previous-article": "goes to the previous article",
  "next-unread": "goes to the next unread article",
  "previous-unread": "goes to the previous unread article",
  "first-article": "goes to the first article",
  "last-article": "goes to the last article",
  open: "opens the article",
  "page-down": "scrolls down a screen",
  "page-up": "scrolls up a screen",
  "open-original": "opens the original",
  "copy-link": "copies the article's link",
  "text-larger": "makes the text larger",
  "text-smaller": "makes the text smaller",
  star: "stars and unstars",
  "next-feed": "goes to the next feed",
  "previous-feed": "goes to the previous feed",
  search: "searches",
  "toggle-sidebar": "shows and hides the sidebar",
  "toggle-list": "shows and hides the article list",
  "toggle-both": "turns full-screen reading on and off",
  "toggle-folder": "folds and unfolds the folder",
  "mark-unread": "marks unread",
  "mark-all-read": "marks all as read",
  "mark-older-read": "marks older as read",
  undo: "undoes",
  refresh: "shows new articles",
  "edit-place": "edits the feed or folder",
  "add-feed": "adds a feed",
};

/** What a key does, for a sentence: "marks older as read". */
export function doesWords(id: string): string {
  return DOES[id] ?? `does ${SHORTCUTS.find((each) => each.bindings.some((binding) => binding.id === id))?.action.toLowerCase() ?? "something else"}`;
}
