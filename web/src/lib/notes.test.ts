import { describe, expect, it } from "vitest";
import { folded, withWaiting, type Waiting } from "./notes.svelte";
import { keptWords } from "./keeping";
import type { Note } from "./shapes";

const QUOTE = { quote: "A letter takes the time it takes", before: "", after: "" };
const made = (id: number, note: string | null = null): Waiting => ({ kind: "highlight", article: 7, id, note, madeAt: 100, ...QUOTE });
const saved = (id: number, more: Partial<Note> = {}): Note => ({ id, ...QUOTE, note: null, madeAt: 100, ...more });

describe("changes kept on this device without a connection", () => {
  it("fold a note into a highlight made offline, and drop one made and removed offline", () => {
    let list = folded([], made(-1));
    list = folded(list, { kind: "change", article: 7, id: -1, note: "Ask her" });
    expect(list).toEqual([made(-1, "Ask her")]);
    expect(folded(list, { kind: "remove", article: 7, id: -1 })).toEqual([]);
  });

  it("keep only the latest note on a highlight, and on the article", () => {
    let list = folded([], { kind: "change", article: 7, id: 3, note: "one" });
    list = folded(list, { kind: "article-note", article: 7, note: "first" });
    list = folded(list, { kind: "change", article: 7, id: 3, note: "two" });
    list = folded(list, { kind: "article-note", article: 7, note: "second" });
    expect(list).toEqual([
      { kind: "change", article: 7, id: 3, note: "two" },
      { kind: "article-note", article: 7, note: "second" },
    ]);
  });

  it("show on the article as if they'd been sent", () => {
    const list: Waiting[] = [made(-5, "mine"), { kind: "remove", article: 7, id: 1 }, { kind: "change", article: 7, id: 2, note: "new" }, { kind: "article-note", article: 7, note: "Whole" }, made(-6)];
    const shown = withWaiting([saved(1), saved(2), saved(9, { quote: null, note: "Old" })], 7, list.slice(0, 4));
    expect(shown.map((each) => [each.id, each.note])).toEqual([
      [2, "new"],
      [-5, "mine"],
      [9, "Whole"],
    ]);
    // Another article's changes are left alone.
    expect(withWaiting([saved(1)], 8, list)).toEqual([saved(1)]);
  });

  it("take the note off the whole article when it's emptied", () => {
    expect(withWaiting([saved(9, { quote: null, note: "Old" })], 7, [{ kind: "article-note", article: 7, note: null }])).toEqual([]);
  });
});

describe("unsubscribing asks about what was kept", () => {
  it("in plain words", () => {
    expect(keptWords({ starred: 3, marked: 1, note: true })).toBe("You starred 3 of their articles, highlighted or noted 1 and wrote a note on them.");
    expect(keptWords({ starred: 0, marked: 2, note: false })).toBe("You highlighted or noted 2 of their articles.");
    expect(keptWords({ starred: 0, marked: 0, note: true })).toBe("You wrote a note on them.");
  });
});
