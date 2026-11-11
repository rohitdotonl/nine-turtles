import { describe, expect, it } from "vitest";
import { afterSent, folded, withWaiting, type Waiting } from "./notes.svelte";
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

  it("lose nothing folded in while the first is on its way", () => {
    const later: Waiting = { kind: "change", article: 7, id: 3, note: "next" };
    const sent = made(-1);
    // Nothing changed meanwhile: it goes, and the rest stay.
    expect(afterSent([sent, later], sent, 12)).toEqual([later]);
    // A note given to it meanwhile is sent next, under the server's number.
    expect(afterSent(folded([sent, later], { kind: "change", article: 7, id: -1, note: "Ask her" }), sent, 12)).toEqual([{ kind: "change", article: 7, id: 12, note: "Ask her" }, later]);
    // Removed meanwhile, it's removed on the server too, and the next change isn't dropped.
    expect(afterSent(folded([sent, later], { kind: "remove", article: 7, id: -1 }), sent, 12)).toEqual([{ kind: "remove", article: 7, id: 12 }, later]);
    // Refused, what was folded into it goes with it.
    expect(afterSent(folded([sent, later], { kind: "change", article: 7, id: -1, note: "Ask her" }), sent)).toEqual([later]);
    // A later note on a saved highlight replaces the one on its way; that one stays to be sent.
    const first: Waiting = { kind: "change", article: 7, id: 3, note: "one" };
    expect(afterSent(folded([first], later), first)).toEqual([later]);
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

  it("save a highlight sent twice once, and lose nothing done to it while it waited (decision 0255)", () => {
    const keyed: Waiting = { kind: "highlight", article: 7, id: -1, note: "Ask her", madeAt: 100, ...QUOTE, key: "k1" };
    const later: Waiting = { kind: "change", article: 7, id: 3, note: "next" };
    // The server answers the copy it already had, with its older note: the note made here goes next.
    expect(afterSent([keyed, later], keyed, 12, null)).toEqual([{ kind: "change", article: 7, id: 12, note: "Ask her" }, later]);
    expect(afterSent([keyed, later], keyed, 12, "Ask her")).toEqual([later]);
    // Removed while it waited, it may be on the server already: it's sent, then removed there.
    const removed = folded([keyed, later], { kind: "remove", article: 7, id: -1 });
    expect(removed).toEqual([{ ...keyed, removed: true }, later]);
    expect(afterSent(removed, removed[0]!, 12, "Ask her")).toEqual([{ kind: "remove", article: 7, id: 12 }, later]);
    // Removed while on its way, likewise.
    expect(afterSent(removed, keyed, 12, "Ask her")).toEqual([{ kind: "remove", article: 7, id: 12 }, later]);
    // One without a key (kept from before) is simply gone, as ever.
    expect(folded([made(-1)], { kind: "remove", article: 7, id: -1 })).toEqual([]);
    // Shown once, as the server's copy, with what was done here.
    expect(withWaiting([saved(12, { key: "k1" })], 7, [keyed]).map((each) => [each.id, each.note])).toEqual([[12, "Ask her"]]);
    expect(withWaiting([saved(12, { key: "k1" })], 7, removed)).toEqual([]);
    expect(withWaiting([], 7, removed)).toEqual([]);
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
