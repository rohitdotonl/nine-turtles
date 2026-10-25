// The keyboard shortcuts (DESIGN.md → "Keyboard", SPEC section 19). This file
// only decides what a key press means; the screens carry it out.
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
  | { kind: "open" }
  | { kind: "open-original" }
  | { kind: "star" }
  | { kind: "mark-unread" }
  | { kind: "mark-all-read" }
  | { kind: "undo" }
  | { kind: "refresh" }
  | { kind: "text-size"; step: 1 | -1 };

export type KeyPress = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
};

const GO_KEYS: Record<string, View> = { u: "unread", s: "starred", a: "all" };

/** How long after `g` the second key still counts, in milliseconds. */
export const SEQUENCE_MS = 1500;

/**
 * Remembers a pending `g` between key presses. `now` is passed in so tests
 * don't depend on the clock.
 */
export function createKeyReader() {
  let pendingGoSince: number | undefined;

  return function read(press: KeyPress, now: number): Action | undefined {
    // Escape always works, even in a field: it's how you leave one.
    if (press.key === "Escape") {
      pendingGoSince = undefined;
      return { kind: "escape" };
    }
    // Shortcuts never fire while typing, or alongside the browser's own keys.
    if (isTyping(press.target) || press.ctrlKey || press.metaKey || press.altKey) return undefined;

    if (pendingGoSince !== undefined && now - pendingGoSince <= SEQUENCE_MS) {
      pendingGoSince = undefined;
      const view = GO_KEYS[press.key];
      return view ? { kind: "go", view } : undefined;
    }
    pendingGoSince = undefined;

    switch (press.key) {
      case "j":
        return { kind: "move", step: 1 };
      case "k":
        return { kind: "move", step: -1 };
      case "Enter":
        // On a button or a link, Enter does what that button or link does.
        return isControl(press.target) ? undefined : { kind: "open" };
      case "o":
        return { kind: "open" };
      case "v":
        return { kind: "open-original" };
      case "s":
        return { kind: "star" };
      case "m":
        return { kind: "mark-unread" };
      case "A": // Shift+A
        return { kind: "mark-all-read" };
      case "u":
        return { kind: "undo" };
      case "r":
        return { kind: "refresh" };
      case "+":
      case "=": // the same key as +, without Shift
        return { kind: "text-size", step: 1 };
      case "-":
        return { kind: "text-size", step: -1 };
      case "g":
        pendingGoSince = now;
        return undefined;
      case "?":
        return { kind: "cheat-sheet" };
      case "[":
        return { kind: "toggle-sidebar" };
      case "]":
        return { kind: "toggle-list" };
      case "\\":
        return { kind: "toggle-both" };
      case "a":
        return { kind: "add-feed" };
      case "/":
        return { kind: "search" };
      default:
        return undefined;
    }
  };
}

function isControl(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  return target.closest("a[href], button, input, select, textarea, summary, [contenteditable]") !== null;
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
 * The cheat sheet's groups, by what you're doing at the time (decision 0061):
 * reading comes first, as it's what nine turtles is for.
 */
export const SHORTCUT_GROUPS = ["Reading", "Getting around", "Tidying up", "Anywhere"] as const;

/** Every shortcut in DESIGN.md, for the `?` cheat sheet. `ready` marks what works today; the sheet lists only those. */
export const SHORTCUTS: { keys: string[]; action: string; ready: boolean; group: (typeof SHORTCUT_GROUPS)[number] }[] = [
  { keys: ["j", "k"], action: "Next / previous article", ready: true, group: "Reading" },
  { keys: ["Enter", "o"], action: "Open article", ready: true, group: "Reading" },
  { keys: ["v"], action: "Open original", ready: true, group: "Reading" },
  { keys: ["+", "-"], action: "Text size", ready: true, group: "Reading" },
  { keys: ["s"], action: "Star / unstar", ready: true, group: "Reading" },
  { keys: ["Esc"], action: "Back / close", ready: true, group: "Reading" },
  { keys: ["g then u"], action: "Go to Unread", ready: true, group: "Getting around" },
  { keys: ["g then s"], action: "Go to Starred", ready: true, group: "Getting around" },
  { keys: ["g then a"], action: "Go to All", ready: true, group: "Getting around" },
  { keys: ["Shift+J", "Shift+K"], action: "Next / previous feed", ready: false, group: "Getting around" },
  { keys: ["/"], action: "Search", ready: true, group: "Getting around" },
  { keys: ["["], action: "Show / hide sidebar", ready: true, group: "Getting around" },
  { keys: ["]"], action: "Show / hide article list", ready: true, group: "Getting around" },
  { keys: ["\\"], action: "Show / hide both", ready: true, group: "Getting around" },
  { keys: ["m"], action: "Mark unread", ready: true, group: "Tidying up" },
  { keys: ["Shift+A"], action: "Mark all as read", ready: true, group: "Tidying up" },
  { keys: ["u"], action: "Undo", ready: true, group: "Tidying up" },
  { keys: ["r"], action: "Show new items", ready: true, group: "Tidying up" },
  { keys: ["a"], action: "Add feed", ready: true, group: "Anywhere" },
  { keys: ["?"], action: "This list of shortcuts", ready: true, group: "Anywhere" },
];

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
  const shifted = /^Shift\+(.)$/.exec(press);
  if (shifted) {
    const key = shifted[1]!.toUpperCase();
    return { cap: `⇧${key}`, spoken: `Shift ${key}` };
  }
  if (/^[a-z]$/.test(press)) return { cap: press.toUpperCase() };
  return { cap: press };
}
