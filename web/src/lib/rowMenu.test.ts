import { describe, expect, it } from "vitest";
import { rowMenu, writerItems } from "./rowMenu";
import type { Article, Feed } from "./shapes";

const article = (changes: Partial<Article> = {}) => ({ id: 1, feedId: 5, feedTitle: "Tomas Berg", title: "On gardens", read: false, starred: false, ...changes }) as Article;
const labels = (groups: ReturnType<typeof rowMenu>) => groups.map((group) => group.items.map((item) => item.label));

describe("rowMenu", () => {
  const hands = () => {
    const done: unknown[] = [];
    return { done, star: (a: Article) => done.push(["star", a.id]), read: (a: Article, read: boolean) => done.push(["read", a.id, read]) };
  };

  it("offers the star and read or unread, each as it isn't yet", () => {
    expect(labels(rowMenu(article(), false, hands()))).toEqual([["Star", "Mark as read"]]);
    expect(labels(rowMenu(article({ read: true, starred: true }), false, hands()))).toEqual([["Unstar", "Mark as unread"]]);
  });

  it("leaves out read and unread with Unread off", () => {
    expect(labels(rowMenu(article(), true, hands()))).toEqual([["Star"]]);
  });

  it("puts the writer's items in a group of their own", () => {
    const groups = rowMenu(article(), false, hands(), [{ label: "Write back", onSelect: () => {} }]);
    expect(labels(groups)).toEqual([["Star", "Mark as read"], ["Write back"]]);
  });

  it("acts on the row's own article", () => {
    const h = hands();
    const [own] = rowMenu(article({ read: true }), false, h);
    own!.items.forEach((item) => item.onSelect());
    expect(h.done).toEqual([["star", 1], ["read", 1, false]]);
  });
});

describe("writerItems", () => {
  const feed = (changes: Partial<Feed> = {}) => ({ id: 5, title: "Tomas Berg", kind: "person", ...changes }) as Feed;
  const library = (feeds: Feed[]) => ({ feeds, shownAs: (f: Feed | undefined) => f, rowOf: (id: number) => id + 100 });

  it("offers Write back and the page about a person", () => {
    const went: unknown[] = [];
    const wrote: number[] = [];
    const items = writerItems(article(), library([feed()]), { go: (place) => went.push(place), writeBack: (a) => wrote.push(a.id) });
    expect(items.map((item) => item.label)).toEqual(["Write back", "Info about Tomas Berg"]);
    items.forEach((item) => item.onSelect());
    expect(wrote).toEqual([1]);
    expect(went).toEqual([{ kind: "about", id: 105 }]);
  });

  it("never offers Write back to a publication", () => {
    const items = writerItems(article(), library([feed({ kind: "publication" })]), { go: () => {}, writeBack: () => {} });
    expect(items.map((item) => item.label)).toEqual(["Info about Tomas Berg"]);
  });

  it("offers nothing for a writer no longer followed", () => {
    expect(writerItems(article(), library([]), { go: () => {}, writeBack: () => {} })).toEqual([]);
  });
});
