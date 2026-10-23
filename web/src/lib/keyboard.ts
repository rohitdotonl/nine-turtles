// The keyboard shortcuts (DESIGN.md → "Keyboard", SPEC section 19). This file
// only decides what a key press means; the screens carry it out.
import type { View } from "./router";

export type Action =
  | { kind: "cheat-sheet" }
  | { kind: "toggle-sidebar" }
  | { kind: "escape" }
  | { kind: "add-feed" }
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
      case "a":
        return { kind: "add-feed" };
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

/** Every shortcut in DESIGN.md, for the `?` cheat sheet. `ready` marks what works today. */
export const SHORTCUTS: { keys: string[]; action: string; ready: boolean }[] = [
  { keys: ["j", "k"], action: "Next / previous item", ready: true },
  { keys: ["Shift+J", "Shift+K"], action: "Next / previous feed", ready: false },
  { keys: ["Enter", "o"], action: "Open item", ready: true },
  { keys: ["v"], action: "Open original", ready: true },
  { keys: ["s"], action: "Star / unstar", ready: true },
  { keys: ["m"], action: "Mark current item unread", ready: true },
  { keys: ["Shift+A"], action: "Mark all as read", ready: true },
  { keys: ["u"], action: "Undo", ready: true },
  { keys: ["r"], action: "Show new items", ready: true },
  { keys: ["/"], action: "Search", ready: false },
  { keys: ["a"], action: "Add feed", ready: true },
  { keys: ["g then u", "g then s", "g then a"], action: "Go to Unread / Starred / All", ready: true },
  { keys: ["["], action: "Show / hide sidebar", ready: true },
  { keys: ["+", "-"], action: "Text size while reading", ready: true },
  { keys: ["Esc"], action: "Back / close", ready: true },
  { keys: ["?"], action: "This list of shortcuts", ready: true },
];
