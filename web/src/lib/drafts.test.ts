import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetDrafts, keepDraft, keepWhileChanged, keptDraft, keptWords, renameDraft, worthKeeping } from "./drafts";

function storage(): Storage {
  const kept = new Map<string, string>();
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
    clear: () => kept.clear(),
    key: () => null,
    get length() {
      return kept.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what the reader typed and hasn't saved (decision 0235)", () => {
  it("keeps each draft under its own name until it's forgotten", () => {
    const kept = storage();
    vi.stubGlobal("localStorage", kept);
    keepDraft("note:article:12", "Ask Asha about the paper");
    keepDraft("edit:folder:3", { name: "Essays", onePerson: false });
    expect(keptWords("note:article:12")).toBe("Ask Asha about the paper");
    expect(keptDraft("edit:folder:3")).toEqual({ name: "Essays", onePerson: false });
    keepDraft("note:article:12", undefined);
    expect(keptDraft("note:article:12")).toBeUndefined();
    expect(keptDraft("edit:folder:3")).toEqual({ name: "Essays", onePerson: false });
    keepDraft("edit:folder:3", undefined);
    // Nothing kept leaves nothing behind on the device.
    expect(kept.length).toBe(0);
  });

  it("keeps changes only while they differ from where they started", () => {
    vi.stubGlobal("localStorage", storage());
    keepWhileChanged("edit:feed:4", { title: "Hal" }, { title: "Hal Brennan" });
    expect(keptDraft("edit:feed:4")).toEqual({ title: "Hal" });
    keepWhileChanged("edit:feed:4", { title: "Hal Brennan" }, { title: "Hal Brennan" });
    expect(keptDraft("edit:feed:4")).toBeUndefined();
  });

  it("follows a highlight made offline to its new number", () => {
    vi.stubGlobal("localStorage", storage());
    keepDraft("note:highlight:-5", "A thought");
    renameDraft("note:highlight:-5", "note:highlight:41");
    expect(keptWords("note:highlight:41")).toBe("A thought");
    expect(keptDraft("note:highlight:-5")).toBeUndefined();
  });

  it("forgets every reader's drafts, and nothing else, when the device is forgotten", () => {
    const kept = new Map<string, string>([
      ["nine-turtles.drafts.1", "{}"],
      ["nine-turtles.drafts.2", "{}"],
      ["nine-turtles.theme", "night"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => void kept.set(key, value),
      removeItem: (key: string) => void kept.delete(key),
      key: (index: number) => [...kept.keys()][index] ?? null,
      get length() {
        return kept.size;
      },
    });
    forgetDrafts();
    expect([...kept.keys()]).toEqual(["nine-turtles.theme"]);
  });

  it("reads words only as words", () => {
    vi.stubGlobal("localStorage", storage());
    keepDraft("note:highlight:9", { not: "words" });
    expect(keptWords("note:highlight:9")).toBeUndefined();
  });

  it("is worth keeping only when the reader wrote something new", () => {
    expect(worthKeeping("A thought", "")).toBe(true);
    expect(worthKeeping("A thought", "A thought ")).toBe(false);
    expect(worthKeeping("  ", "")).toBe(false);
    // A video's time alone isn't the reader's words.
    expect(worthKeeping("12:34 ", "12:34 ")).toBe(false);
    expect(worthKeeping("1:02:03", "")).toBe(false);
    expect(worthKeeping("12:34 the turn", "12:34 ")).toBe(true);
  });

  it("survives a browser that refuses to keep anything", () => {
    vi.stubGlobal("localStorage", undefined);
    keepDraft("add", "example.com");
    expect(keptDraft("add")).toBeUndefined();
  });
});
