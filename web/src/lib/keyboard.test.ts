import { describe, expect, it } from "vitest";
import { SEQUENCE_MS, SHORTCUTS, createKeyReader, keyCap, keyFor, pressName, shortcutMatches, shortcutsFor, type KeyPress } from "./keyboard";

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: null,
  ...extra,
});

describe("keyboard shortcuts", () => {
  it("opens the cheat sheet with ?, toggles the sidebar with [ and closes with Escape", () => {
    const read = createKeyReader();
    expect(read(press("?"), 0)).toEqual({ kind: "cheat-sheet" });
    expect(read(press("["), 0)).toEqual({ kind: "toggle-sidebar" });
    expect(read(press("]"), 0)).toEqual({ kind: "toggle-list" });
    expect(read(press("\\"), 0)).toEqual({ kind: "toggle-both" });
    expect(read(press("Escape"), 0)).toEqual({ kind: "escape" });
  });

  it("puts you in the search field with /, but not while typing", () => {
    const read = createKeyReader();
    expect(read(press("/"), 0)).toEqual({ kind: "search" });
  });

  it("opens Add a feed with a, unless it follows g", () => {
    const read = createKeyReader();
    expect(read(press("a"), 0)).toEqual({ kind: "add-feed" });
    read(press("g"), 0);
    expect(read(press("a"), 10)).toEqual({ kind: "go", view: "all" });
  });

  it("goes to Unread, Starred and All with g then u, s or a", () => {
    const read = createKeyReader();
    for (const [key, view] of [
      ["u", "unread"],
      ["s", "starred"],
      ["a", "all"],
    ] as const) {
      expect(read(press("g"), 0)).toBeUndefined();
      expect(read(press(key), 100)).toEqual({ kind: "go", view });
    }
  });

  it("forgets a g after a pause, or when another key follows", () => {
    const read = createKeyReader();
    // u on its own is Undo, not Go to Unread.
    read(press("g"), 0);
    expect(read(press("u"), SEQUENCE_MS + 1)).toEqual({ kind: "undo" });
    read(press("g"), 0);
    expect(read(press("x"), 10)).toBeUndefined();
    expect(read(press("u"), 20)).toEqual({ kind: "undo" });
  });

  it("moves with j and k, opens with Enter or o, the original with v, and sizes text with + and -", () => {
    const read = createKeyReader();
    expect(read(press("j"), 0)).toEqual({ kind: "move", step: 1 });
    expect(read(press("k"), 0)).toEqual({ kind: "move", step: -1 });
    expect(read(press("Enter"), 0)).toEqual({ kind: "open" });
    expect(read(press("o"), 0)).toEqual({ kind: "open" });
    expect(read(press("v"), 0)).toEqual({ kind: "open-original" });
    expect(read(press("+"), 0)).toEqual({ kind: "text-size", step: 1 });
    expect(read(press("="), 0)).toEqual({ kind: "text-size", step: 1 });
    expect(read(press("-"), 0)).toEqual({ kind: "text-size", step: -1 });
  });

  it("stars with s, marks unread with m, marks all as read with Shift+A and undoes with u", () => {
    const read = createKeyReader();
    expect(read(press("s"), 0)).toEqual({ kind: "star" });
    expect(read(press("m"), 0)).toEqual({ kind: "mark-unread" });
    expect(read(press("A"), 0)).toEqual({ kind: "mark-all-read" });
    expect(read(press("u"), 0)).toEqual({ kind: "undo" });
  });

  it("shows new items with r, but leaves the browser's own reload (Ctrl+R) alone", () => {
    const read = createKeyReader();
    expect(read(press("r"), 0)).toEqual({ kind: "refresh" });
    expect(read(press("r", { ctrlKey: true }), 0)).toBeUndefined();
    expect(read(press("r", { metaKey: true }), 0)).toBeUndefined();
  });

  it("leaves the browser's own shortcuts alone", () => {
    const read = createKeyReader();
    expect(read(press("[", { metaKey: true }), 0)).toBeUndefined();
    expect(read(press("?", { ctrlKey: true }), 0)).toBeUndefined();
  });

  it("lists every shortcut in SPEC.md in the cheat sheet", () => {
    expect(SHORTCUTS).toHaveLength(26);
    expect(SHORTCUTS.filter((shortcut) => shortcut.ready).map((shortcut) => shortcut.keys[0])).toEqual([
      "j",
      "n",
      "Enter",
      "Space",
      "v",
      "c",
      "+",
      "s",
      "Esc",
      "g then u",
      "g then s",
      "g then a",
      "/",
      "[",
      "]",
      "\\",
      "e",
      "m",
      "Shift+A",
      "Shift+O",
      "u",
      "r",
      "Shift+E",
      "a",
      "?",
    ]);
  });

  // Space on a button or a tick box stays theirs: the browser tests check that (tests/reading.spec.ts).
  it("scrolls the article with Space and Shift+Space", () => {
    const read = createKeyReader();
    expect(read(press(" "), 0)).toEqual({ kind: "page", step: 1 });
    expect(read(press(" ", { shiftKey: true }), 0)).toEqual({ kind: "page", step: -1 });
    expect(read(press(" ", { ctrlKey: true }), 0)).toBeUndefined();
  });

  it("moves to unread articles with n and Shift+N, marks older as read with Shift+O, copies the link with c, and folds or edits with e and Shift+E", () => {
    const read = createKeyReader();
    expect(read(press("n"), 0)).toEqual({ kind: "move-unread", step: 1 });
    expect(read(press("N"), 0)).toEqual({ kind: "move-unread", step: -1 });
    expect(read(press("O"), 0)).toEqual({ kind: "mark-older-read" });
    expect(read(press("c"), 0)).toEqual({ kind: "copy-link" });
    expect(read(press("e"), 0)).toEqual({ kind: "toggle-folder" });
    expect(read(press("E"), 0)).toEqual({ kind: "edit-place" });
    expect(keyFor("mark-older-read")).toBe("Shift+O");
    expect(keyFor("copy-link")).toBe("c");
  });

  it("prints keys as a Mac does: capital letters, ⇧ for Shift, a true minus sign, and plain words for screen readers", () => {
    expect(keyCap("j")).toEqual({ cap: "J" });
    expect(keyCap("Shift+A")).toEqual({ cap: "⇧A", spoken: "Shift A" });
    expect(keyCap("Shift+j")).toEqual({ cap: "⇧J", spoken: "Shift J" });
    expect(keyCap("-")).toEqual({ cap: "−" });
    for (const key of ["Enter", "Esc", "[", "/", "?", "+"]) expect(keyCap(key)).toEqual({ cap: key });
  });
});

/**
 * The owner's check (decision 0103): the keys that work and the keys the
 * cheat sheet lists can never drift apart. Every key a keyboard can type is
 * pressed, alone and after `g`; any that does something must be listed,
 * and every listed key must do what its row says.
 */
describe("the cheat sheet and the keys agree", () => {
  const OTHER_KEYS = ["Enter", "Escape", "Tab", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"];
  const presses: KeyPress[] = [
    ...Array.from({ length: 126 - 32 }, (_, index) => press(String.fromCharCode(33 + index))),
    press(" "),
    press(" ", { shiftKey: true }),
    ...OTHER_KEYS.map((key) => press(key)),
  ].filter((each) => each.key.length > 0 && each.key !== "\u007f");
  const spelled = (each: KeyPress) => (each.key === " " ? (each.shiftKey ? "Shift+ " : " ") : each.key);

  /** Every key the reader answers, as presses, alone or as the second after a first press that waits. */
  function answered(): { keys: string; does: unknown }[] {
    const found: { keys: string; does: unknown }[] = [];
    for (const first of presses) {
      const read = createKeyReader();
      const does = read(first, 0);
      if (does) {
        found.push({ keys: spelled(first), does });
        continue;
      }
      // A press that does nothing alone may start two (g then u): try every second press after it,
      // and keep those that do something other than the second press does alone.
      for (const second of presses) {
        const after = createKeyReader();
        after(first, 0);
        const then = after(second, 10);
        const alone = createKeyReader()(second, 0);
        if (then && JSON.stringify(then) !== JSON.stringify(alone)) found.push({ keys: `${spelled(first)} then ${spelled(second)}`, does: then });
      }
    }
    return found;
  }

  const listed = shortcutsFor(false).flatMap((each) =>
    each.bindings.map(([key, does]) => ({ keys: key.split(" then ").map(pressName).join(" then "), does })),
  );
  const unlisted = SHORTCUTS.flatMap((each) => each.unlisted.map(([key]) => pressName(key)));

  it("lists every key that does something (only = stands in for +, unprinted)", () => {
    expect(unlisted).toEqual(["="]);
    const missing = answered().filter((each) => !listed.some((entry) => entry.keys === each.keys) && !unlisted.includes(each.keys));
    expect(missing).toEqual([]);
  });

  it("gives every listed key the action its row says", () => {
    const found = answered();
    for (const entry of listed) expect(found.find((each) => each.keys === entry.keys)?.does, entry.keys).toEqual(entry.does);
  });

  it("keeps the keys of a shortcut that isn't built yet doing nothing", () => {
    const later = SHORTCUTS.filter((each) => !each.ready);
    expect(later.map((each) => each.action)).toEqual(["Next / previous feed"]);
    const read = createKeyReader();
    for (const key of later.flatMap((each) => each.keys)) expect(read(press(pressName(key)), 0)).toBeUndefined();
  });

  it("prints Space and Shift+Space as keys, so screen readers hear them in words", () => {
    expect(keyCap("Space")).toEqual({ cap: "Space" });
    expect(keyCap("Shift+Space")).toEqual({ cap: "⇧Space", spoken: "Shift Space" });
  });
});

describe("finding a shortcut (decision 0062)", () => {
  const star = { keys: ["s"], action: "Star / unstar" };
  const go = { keys: ["g then u"], action: "Go to Unread" };
  const all = { keys: ["Shift+A"], action: "Mark all as read" };

  it("finds by words, whatever their case", () => {
    expect(shortcutMatches(star, "STAR")).toBe(true);
    expect(shortcutMatches(go, "unread")).toBe(true);
    expect(shortcutMatches(star, "unread")).toBe(false);
  });

  it("finds by key, as printed or with the presses spaced", () => {
    expect(shortcutMatches(star, "s")).toBe(true);
    expect(shortcutMatches(go, "g u")).toBe(true);
    expect(shortcutMatches(go, "g then u")).toBe(true);
    expect(shortcutMatches(all, "shift a")).toBe(true);
    expect(shortcutMatches(all, "⇧a")).toBe(true);
    expect(shortcutMatches(go, "s")).toBe(false);
  });

  it("shows everything when nothing is typed", () => {
    expect(shortcutMatches(star, "  ")).toBe(true);
  });
});

describe("the cheat sheet in river mode", () => {
  it("leaves out Go to Unread, Mark all as read, Mark older as read and the unread moves, and keeps the rest", () => {
    const inbox = shortcutsFor(false).map((each) => each.action);
    const river = shortcutsFor(true).map((each) => each.action);
    const unreadOnly = ["Go to Unread", "Mark all as read", "Mark older as read", "Next / previous unread article"];
    for (const action of unreadOnly) {
      expect(inbox).toContain(action);
      expect(river).not.toContain(action);
    }
    expect(river).toContain("Mark unread");
    expect(river.length).toBe(inbox.length - unreadOnly.length);
  });
});
