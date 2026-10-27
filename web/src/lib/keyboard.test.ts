import { describe, expect, it } from "vitest";
import { feedNextTo, type Feed } from "./feeds";
import {
  SEQUENCE_MS,
  SHORTCUTS,
  chooseKey,
  createKeyReader,
  doesWords,
  holderOf,
  isChanged,
  keyCap,
  keyFor,
  keyOf,
  keyWords,
  pressName,
  rebind,
  shortcutMatches,
  shortcutsFor,
  withKey,
  type KeyMap,
  type KeyPress,
} from "./keyboard";

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
    expect(read(press("l"), 0)).toEqual({ kind: "collect" });
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
    expect(SHORTCUTS).toHaveLength(31);
    expect(SHORTCUTS.filter((shortcut) => shortcut.ready).map((shortcut) => shortcut.keys[0])).toEqual([
      "j",
      "n",
      "Home",
      "Enter",
      "Space",
      "v",
      "c",
      "+",
      "s",
      "l",
      "Esc",
      "g then u",
      "g then s",
      "g then a",
      "g then r",
      "g then f",
      "g then ,",
      "Shift+J",
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

  // Space on a button or a tick box stays theirs: the browser tests check that (tests/shortcuts.spec.ts).
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
/**
 * The owner's check (decision 0103): the keys that work and the keys the
 * cheat sheet lists can never drift apart. Every key a keyboard can type is
 * pressed, alone and after `g`; any that does something must be listed,
 * and every listed key must do what its row says. It must hold with the
 * reader's own keys too (decision 0110): a few sets of changed keys are tried.
 */
const CUSTOM: [string, KeyMap][] = [
  ["nine turtles' own keys", {}],
  ["star moved to x", { star: "x" }],
  ["Shift+O taken by star, mark older left with no key", { star: "Shift+O", "mark-older-read": "" }],
  ["+ moved to ], so = no longer stands in, and the list key left with none", { "text-larger": "]", "toggle-list": "" }],
  ["Space and Home swapped with letters", { "page-down": "q", "first-article": "Space", "next-article": "Home", "previous-article": "" }],
  ["= given to undo", { undo: "=" }],
];

describe.each(CUSTOM)("the cheat sheet and the keys agree: %s", (_, custom) => {
  const OTHER_KEYS = ["Enter", "Escape", "Tab", "Backspace", "Delete", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"];
  const presses: KeyPress[] = [
    ...Array.from({ length: 126 - 32 }, (_, index) => press(String.fromCharCode(33 + index))),
    press(" "),
    press(" ", { shiftKey: true }),
    ...OTHER_KEYS.map((key) => press(key)),
  ].filter((each) => each.key.length > 0 && each.key !== "\u007f");
  const spelled = (each: KeyPress) => (each.key === " " ? (each.shiftKey ? "Shift+ " : " ") : each.key);
  const reader = () => createKeyReader(() => custom);

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

  const sheet = shortcutsFor(false, custom);
  const listed = sheet.flatMap((each) =>
    each.bindings.filter(({ key }) => key !== "").map(({ key, does }) => ({ keys: key.split(" then ").map(pressName).join(" then "), does })),
  );
  const unlisted = sheet.flatMap((each) => each.unlisted.map((extra) => pressName(extra.key)));

  it("lists every key that does something (only = stands in for +, unprinted, while + is the + key)", () => {
    expect(unlisted).toEqual(custom["text-larger"] || custom.undo === "=" ? [] : ["="]);
    const missing = answered().filter((each) => !listed.some((entry) => entry.keys === each.keys) && !unlisted.includes(each.keys));
    expect(missing).toEqual([]);
  });

  it("gives every listed key the action its row says", () => {
    const found = answered();
    for (const entry of listed) expect(found.find((each) => each.keys === entry.keys)?.does, entry.keys).toEqual(entry.does);
  });

  it("prints each row's keys as the reader chose them, and never one key twice", () => {
    const printed = sheet.flatMap((each) => each.keys);
    expect(new Set(printed).size).toBe(printed.length);
    for (const [id, key] of Object.entries(custom)) {
      const row = sheet.find((each) => each.bindings.some((binding) => binding.id === id));
      expect(row?.bindings.find((binding) => binding.id === id)?.key).toBe(key);
      if (key === "") expect(row?.keys).not.toContain(keyOf(id));
    }
  });

  it("keeps the keys of a shortcut that isn't built yet doing nothing", () => {
    const later = SHORTCUTS.filter((each) => !each.ready);
    // None today: Go to Recently read (g then r) was the last, until /recent opened Recently read.
    expect(later.map((each) => each.action)).toEqual([]);
    for (const key of later.flatMap((each) => each.keys)) {
      const read = reader();
      const [first, second] = key.split(" then ");
      expect(read(press(pressName(first!)), 0)).toBeUndefined();
      if (second) expect(read(press(pressName(second)), 10)).toBeUndefined();
    }
  });
});

describe("keys printed as words", () => {
  it("prints Space and Shift+Space as keys, so screen readers hear them in words", () => {
    expect(keyCap("Space")).toEqual({ cap: "Space" });
    expect(keyCap("Shift+Space")).toEqual({ cap: "⇧Space", spoken: "Shift Space" });
  });

  it("says keys in plain words for sentences and tooltips", () => {
    expect(keyWords("Shift+O")).toBe("Shift+O");
    expect(keyWords("s")).toBe("S");
    expect(keyWords("g then u")).toBe("G then U");
    expect(keyWords("-")).toBe("-");
    expect(withKey("Star", "s")).toBe("Star (S)");
    expect(withKey("Star", undefined)).toBe("Star");
    expect(withKey("Hide the sidebar", "[")).toBe("Hide the sidebar ( [ )");
    expect(withKey("Smaller text", "-")).toBe("Smaller text (−)");
  });
});

/** Choosing keys (decision 0110): what a press becomes, and what happens to the key it was. */
describe("choosing keys", () => {
  it("turns a press into a key as the cheat sheet prints it", () => {
    expect(chooseKey(press("x"))).toEqual({ key: "x" });
    expect(chooseKey(press("X", { shiftKey: true }))).toEqual({ key: "Shift+X" });
    expect(chooseKey(press("!", { shiftKey: true }))).toEqual({ key: "!" });
    expect(chooseKey(press(" "))).toEqual({ key: "Space" });
    expect(chooseKey(press(" ", { shiftKey: true }))).toEqual({ key: "Shift+Space" });
    expect(chooseKey(press("Home"))).toEqual({ key: "Home" });
    expect(chooseKey(press("5"))).toEqual({ key: "5" });
  });

  it("keeps waiting while only Shift, Ctrl, Option or ⌘ is pressed", () => {
    for (const key of ["Shift", "Control", "Alt", "Meta", "CapsLock"]) expect(chooseKey(press(key))).toBeUndefined();
  });

  it("refuses keys that can't be shortcuts, saying why", () => {
    for (const refused of [
      press("Enter"),
      press("?"),
      press("g"),
      press("Tab"),
      press("ArrowDown"),
      press("F5"),
      press("Home", { shiftKey: true }),
      press("s", { metaKey: true }),
      press("s", { ctrlKey: true }),
      press("s", { altKey: true }),
    ]) {
      const answer = chooseKey(refused);
      expect(answer && "refused" in answer && answer.refused.length > 0, refused.key).toBe(true);
    }
  });

  it("gives a key that's free at once, keeping only what differs from nine turtles' own", () => {
    expect(holderOf("x", {}, "star")).toBeUndefined();
    const moved = rebind({}, "star", "x");
    expect(moved).toEqual({ star: "x" });
    expect(keyOf("star", moved)).toBe("x");
    expect(isChanged("star", moved)).toBe(true);
    // Back to its own key: nothing is kept.
    expect(rebind(moved, "star", "s")).toEqual({});
  });

  it("takes a key from the shortcut that had it, which is left with no key", () => {
    expect(holderOf("Shift+O", {}, "star")?.id).toBe("mark-older-read");
    expect(`${keyWords("Shift+O")} already ${doesWords("mark-older-read")}.`).toBe("Shift+O already marks older as read.");
    const taken = rebind({}, "star", "Shift+O");
    expect(taken).toEqual({ star: "Shift+O", "mark-older-read": "" });
    expect(keyFor("mark-older-read", taken)).toBeUndefined();
    expect(shortcutsFor(false, taken).find((each) => each.action === "Mark older as read")?.keys).toEqual([]);
    expect(holderOf("Shift+O", taken, "mark-older-read")?.id).toBe("star");
    expect(rebind(taken, "mark-older-read", "Shift+O")).toEqual({ star: "" });
  });

  it("never changes a fixed key", () => {
    expect(rebind({}, "cheat-sheet", "x")).toEqual({});
    expect(rebind({}, "go-unread", "x")).toEqual({});
    expect(keyOf("escape", { escape: "x" })).toBe("Esc");
  });

  it("puts every key back with an empty set", () => {
    expect(shortcutsFor(false, {})).toEqual(shortcutsFor(false));
  });
});

describe("moving between feeds with Shift+J and Shift+K (decision 0110)", () => {
  const feed = (id: number, folders: number[] = []): Feed => ({ id, folders }) as unknown as Feed;
  // Folders A (1) and B (2); feed 10 in A, 11 in A and B, 12 in B, 13 and 14 in none.
  const library = {
    folders: [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ],
    feeds: [feed(10, [1]), feed(11, [1, 2]), feed(12, [2]), feed(13), feed(14)],
  };

  it("follows the sidebar: open folders' feeds, then the feeds in no folder, each once", () => {
    const open = [1, 2];
    const order: number[] = [];
    let here: { kind: string; id?: number } = { kind: "view" };
    for (;;) {
      const next = feedNextTo(library, open, here, 1);
      if (next === undefined) break;
      order.push(next);
      here = { kind: "feed", id: next };
    }
    expect(order).toEqual([10, 11, 12, 13, 14]);
    expect(feedNextTo(library, open, { kind: "feed", id: 13 }, -1)).toBe(12);
  });

  it("passes over a folded folder's feeds, and starts from a folder's own row", () => {
    expect(feedNextTo(library, [2], { kind: "view" }, 1)).toBe(11);
    expect(feedNextTo(library, [], { kind: "folder", id: 2 }, 1)).toBe(13);
    expect(feedNextTo(library, [1, 2], { kind: "folder", id: 2 }, 1)).toBe(12);
    // In a feed whose folder is folded: from that folder's row.
    expect(feedNextTo(library, [], { kind: "feed", id: 10 }, 1)).toBe(13);
  });

  it("stops at either end, and Shift+K from Unread, Starred or All goes nowhere", () => {
    expect(feedNextTo(library, [1, 2], { kind: "feed", id: 14 }, 1)).toBeUndefined();
    expect(feedNextTo(library, [1, 2], { kind: "feed", id: 10 }, -1)).toBeUndefined();
    expect(feedNextTo(library, [1, 2], { kind: "view" }, -1)).toBeUndefined();
  });
});

describe("the new keys", () => {
  it("moves to the first and last article with Home and End, between feeds with Shift+J and Shift+K, and goes places with g then f and g then ,", () => {
    const read = createKeyReader();
    expect(read(press("Home"), 0)).toEqual({ kind: "move-end", step: -1 });
    expect(read(press("End"), 0)).toEqual({ kind: "move-end", step: 1 });
    expect(read(press("J"), 0)).toEqual({ kind: "move-feed", step: 1 });
    expect(read(press("K"), 0)).toEqual({ kind: "move-feed", step: -1 });
    read(press("g"), 0);
    expect(read(press("f"), 10)).toEqual({ kind: "go-to", path: "/settings/feeds" });
    read(press("g"), 0);
    expect(read(press(","), 10)).toEqual({ kind: "go-to", path: "/settings" });
  });

  it("follows the reader's keys as they change, without a new reader", () => {
    let custom: KeyMap = {};
    const read = createKeyReader(() => custom);
    expect(read(press("s"), 0)).toEqual({ kind: "star" });
    custom = { star: "x" };
    expect(read(press("s"), 0)).toBeUndefined();
    expect(read(press("x"), 0)).toEqual({ kind: "star" });
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
