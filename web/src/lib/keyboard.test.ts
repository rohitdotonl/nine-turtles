import { describe, expect, it } from "vitest";
import { SEQUENCE_MS, SHORTCUTS, createKeyReader, type KeyPress } from "./keyboard";

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
    expect(read(press("Escape"), 0)).toEqual({ kind: "escape" });
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
    read(press("g"), 0);
    expect(read(press("u"), SEQUENCE_MS + 1)).toBeUndefined();
    read(press("g"), 0);
    expect(read(press("x"), 10)).toBeUndefined();
    expect(read(press("u"), 20)).toBeUndefined();
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

  it("leaves the browser's own shortcuts alone", () => {
    const read = createKeyReader();
    expect(read(press("[", { metaKey: true }), 0)).toBeUndefined();
    expect(read(press("?", { ctrlKey: true }), 0)).toBeUndefined();
  });

  it("lists every shortcut in DESIGN.md in the cheat sheet", () => {
    expect(SHORTCUTS).toHaveLength(16);
    expect(SHORTCUTS.filter((shortcut) => shortcut.ready).map((shortcut) => shortcut.keys[0])).toEqual([
      "j",
      "Enter",
      "v",
      "a",
      "g then u",
      "[",
      "+",
      "Esc",
      "?",
    ]);
  });
});
