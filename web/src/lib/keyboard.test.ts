import { describe, expect, it } from "vitest";
import type { Feed } from "./shapes";
import { sidebarRowNextTo } from "./feeds";
import {
  SEQUENCE_MS,
  SHORTCUTS,
  createKeyReader,
  keyCap,
  keyFor,
  keyOf,
  pressName,
  shortcutsFor,
  tip,
  withKey,
  type KeyPress,
} from "./keyboard";

// As a browser with Caps Lock off says it: a capital letter comes with Shift.
const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: /^[A-Z]$/.test(key),
  target: null,
  ...extra,
});

describe("keyboard shortcuts", () => {
  it("opens the cheat sheet with ?, hides both panes with f and closes with Escape", () => {
    const read = createKeyReader();
    expect(read(press("?"), 0)).toEqual({ kind: "cheat-sheet" });
    expect(read(press("f"), 0)).toEqual({ kind: "toggle-both" });
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
    // Enter opens; o did too until decision 0180.
    expect(read(press("o"), 0)).toBeUndefined();
    expect(read(press("v"), 0)).toEqual({ kind: "open-original" });
    expect(read(press("+"), 0)).toEqual({ kind: "text-size", step: 1 });
    expect(read(press("="), 0)).toEqual({ kind: "text-size", step: 1 });
    expect(read(press("-"), 0)).toEqual({ kind: "text-size", step: -1 });
  });

  it("stars with s, marks unread with m, marks all as read with Shift+A and undoes with u", () => {
    const read = createKeyReader();
    expect(read(press("s"), 0)).toEqual({ kind: "star" });
    // l added an article to a collection; collections are gone (decision 0174).
    expect(read(press("l"), 0)).toBeUndefined();
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

  it("reads letters the same with Caps Lock on: the capital without Shift is the plain key, and Shift makes it the Shift key", () => {
    const read = createKeyReader();
    expect(read(press("J", { shiftKey: false }), 0)).toEqual(read(press("j"), 0));
    expect(read(press("A", { shiftKey: false }), 0)).toEqual({ kind: "add-feed" });
    expect(read(press("a", { shiftKey: true }), 0)).toEqual({ kind: "mark-all-read" });
    read(press("G", { shiftKey: false }), 0);
    expect(read(press("U", { shiftKey: false }), 10)).toEqual({ kind: "go", view: "unread" });
  });

  it("leaves keys alone while a word is being composed (Chinese, Japanese and the like)", () => {
    const read = createKeyReader();
    expect(read(press("Escape", { isComposing: true }), 0)).toBeUndefined();
    expect(read(press("j", { isComposing: true }), 0)).toBeUndefined();
  });

  it("leaves the browser's own shortcuts alone", () => {
    const read = createKeyReader();
    expect(read(press("f", { metaKey: true }), 0)).toBeUndefined();
    expect(read(press("?", { ctrlKey: true }), 0)).toBeUndefined();
  });

  it("lists every shortcut in SPEC.md in the cheat sheet", () => {
    expect(SHORTCUTS).toHaveLength(27);
    expect(SHORTCUTS.map((shortcut) => shortcut.keys[0])).toEqual([
      "j",
      "w",
      "Enter",
      "s",
      "h",
      "n",
      "v",
      "Space",
      "+",
      "c",
      "Esc",
      "g then u",
      "g then s",
      "g then n",
      "g then a",
      "g then ,",
      "/",
      "Shift+J",
      "e",
      "i",
      "f",
      "a",
      "Shift+A",
      "m",
      "u",
      "r",
      "?",
    ]);
  });

  // Space on a button or a tick box stays theirs: the browser tests check that (tests/shortcuts.spec.ts).
  it("scrolls the article with Space and Shift+Space", () => {
    const read = createKeyReader();
    expect(read(press(" "), 0)).toEqual({ kind: "page", step: 1 });
    expect(read(press(" ", { shiftKey: true }), 0)).toEqual({ kind: "page", step: -1 });
    expect(read(press(" ", { ctrlKey: true }), 0)).toBeUndefined();
  });

  it("copies the link with c, and answers none of the keys cut in decisions 0171 and 0180", () => {
    const read = createKeyReader();
    for (const cut of ["O", "N", "H", "E", "[", "]", "\\"]) expect(read(press(cut), 0), cut).toBeUndefined();
    expect(read(press("c"), 0)).toEqual({ kind: "copy-link" });
    expect(read(press("e"), 0)).toEqual({ kind: "toggle-folder" });
    expect(read(press("n"), 0)).toEqual({ kind: "note" });
    expect(keyFor("copy-link")).toBe("c");
  });

  it("prints keys the same on every computer: capital letters, Shift as the word, a true minus sign", () => {
    expect(keyCap("j")).toBe("J");
    expect(keyCap("Shift+A")).toBe("Shift A");
    expect(keyCap("Shift+j")).toBe("Shift J");
    expect(keyCap("-")).toBe("−");
    for (const key of ["Enter", "Esc", "\\", "/", "?", "+"]) expect(keyCap(key)).toBe(key);
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
  const reader = () => createKeyReader();

  /** Every key the reader answers, as presses, alone or as the second after a first press that waits. */
  function answered(): { keys: string; does: unknown }[] {
    const found: { keys: string; does: unknown }[] = [];
    for (const first of presses) {
      const read = reader();
      const does = read(first, 0);
      if (does) {
        found.push({ keys: spelled(first), does });
        continue;
      }
      // A press that does nothing alone may start two (g then u): try every second press after it,
      // and keep those that do something other than the second press does alone.
      for (const second of presses) {
        const after = reader();
        after(first, 0);
        const then = after(second, 10);
        const alone = reader()(second, 0);
        if (then && JSON.stringify(then) !== JSON.stringify(alone)) found.push({ keys: `${spelled(first)} then ${spelled(second)}`, does: then });
      }
    }
    return found;
  }

  const sheet = shortcutsFor(false);
  const listed = sheet.flatMap((each) =>
    each.bindings.map(({ key, does }) => ({ keys: key.split(" then ").map(pressName).join(" then "), does })),
  );
  const unlisted = sheet.flatMap((each) => each.unlisted.map((extra) => pressName(extra.key)));

  it("lists every key that does something (only Home and End, the browser's own keys, and = for +, go unprinted)", () => {
    expect(unlisted).toEqual(["Home", "End", "="]);
    const missing = answered().filter((each) => !listed.some((entry) => entry.keys === each.keys) && !unlisted.includes(each.keys));
    expect(missing).toEqual([]);
  });

  it("gives every listed key the action its row says", () => {
    const found = answered();
    for (const entry of listed) expect(found.find((each) => each.keys === entry.keys)?.does, entry.keys).toEqual(entry.does);
  });

  it("never prints one key twice", () => {
    const printed = sheet.flatMap((each) => each.keys);
    expect(new Set(printed).size).toBe(printed.length);
  });
});

describe("keys printed as words", () => {
  it("prints Space and Shift+Space as keys, so screen readers hear them in words", () => {
    expect(keyCap("Space")).toBe("Space");
    expect(keyCap("Shift+Space")).toBe("Shift Space");
  });

  it("gives menus and tooltips their keys", () => {
    expect(keyFor("star")).toBe("s");
    expect(keyOf("text-smaller")).toBe("-");
    expect(keyOf("no-such-key")).toBeUndefined();
    expect(tip("Star", "star")).toBe("Star (S)");
    expect(withKey("Star", "s")).toBe("Star (S)");
    expect(withKey("Star", undefined)).toBe("Star");
    expect(withKey("Mark all as read", "Shift+A")).toBe("Mark all as read (Shift A)");
    expect(withKey("Smaller text", "-")).toBe("Smaller text (−)");
  });
});

describe("moving down the sidebar with Shift+J and Shift+K (decisions 0110, 0180)", () => {
  const feed = (id: number, folders: number[] = []): Feed => ({ id, folders }) as unknown as Feed;
  // Folders A (1) and B (2); feed 10 in A, 11 in A and B, 12 in B, 13 and 14 in none.
  const library = {
    folders: [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ],
    feeds: [feed(10, [1]), feed(11, [1, 2]), feed(12, [2]), feed(13), feed(14)],
  };

  const views = ["unread", "starred", "all"] as const;
  const row = (kind: "feed" | "folder", id: number) => ({ kind, id });
  const unread = { kind: "view", view: "unread" } as const;
  const lastList = { kind: "view", view: "all" } as const;

  it("follows the sidebar top to bottom: its lists, each folder, its feeds while it's open, then the feeds in no folder, each once", () => {
    const order: string[] = [];
    let here: Parameters<typeof sidebarRowNextTo>[3] = unread;
    for (;;) {
      const next = sidebarRowNextTo(library, views, [1, 2], here, 1);
      if (next === undefined) break;
      order.push(next.kind === "view" ? next.view : `${next.kind} ${next.id}`);
      here = next;
    }
    expect(order).toEqual(["starred", "all", "folder 1", "feed 10", "feed 11", "folder 2", "feed 12", "feed 13", "feed 14"]);
    expect(sidebarRowNextTo(library, views, [1, 2], row("feed", 13), -1)).toEqual(row("feed", 12));
  });

  it("stops at a folded folder and passes over its feeds, so the next press goes to the next folder", () => {
    expect(sidebarRowNextTo(library, views, [], lastList, 1)).toEqual(row("folder", 1));
    expect(sidebarRowNextTo(library, views, [], row("folder", 1), 1)).toEqual(row("folder", 2));
    expect(sidebarRowNextTo(library, views, [], row("folder", 2), 1)).toEqual(row("feed", 13));
    expect(sidebarRowNextTo(library, views, [], row("folder", 2), -1)).toEqual(row("folder", 1));
    // In a feed whose folder is folded: from that folder's row.
    expect(sidebarRowNextTo(library, views, [], row("feed", 10), 1)).toEqual(row("folder", 2));
  });

  it("stops at either end", () => {
    expect(sidebarRowNextTo(library, views, [1, 2], row("feed", 14), 1)).toBeUndefined();
    expect(sidebarRowNextTo(library, views, [1, 2], unread, -1)).toBeUndefined();
  });
});

describe("the new keys", () => {
  it("moves to the first and last article with Home and End, between feeds with Shift+J and Shift+K, and goes to Settings with g then ,", () => {
    const read = createKeyReader();
    expect(read(press("Home"), 0)).toEqual({ kind: "move-end", step: -1 });
    expect(read(press("End"), 0)).toEqual({ kind: "move-end", step: 1 });
    expect(read(press("J"), 0)).toEqual({ kind: "move-feed", step: 1 });
    expect(read(press("K"), 0)).toEqual({ kind: "move-feed", step: -1 });
    read(press("g"), 0);
    expect(read(press(","), 10)).toEqual({ kind: "go-to", path: "/settings" });
  });
});

describe("the cheat sheet with Unread off", () => {
  it("leaves out Go to Unread and Mark all as read, and keeps the rest", () => {
    const on = shortcutsFor(false).map((each) => each.action);
    const off = shortcutsFor(true).map((each) => each.action);
    const unreadOnly = ["Unread", "Mark all as read"];
    for (const action of unreadOnly) {
      expect(on).toContain(action);
      expect(off).not.toContain(action);
    }
    expect(off).toContain("Mark unread");
    expect(off.length).toBe(on.length - unreadOnly.length);
  });
});
