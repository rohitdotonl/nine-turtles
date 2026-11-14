import { describe, expect, it } from "vitest";
import type { Article, Feed } from "./shapes";
import { headsOf, placeLabels, writerOf, placeShownAs, placesOf, placesWatch, rowFor, rowsOf, siteName, sourceOf } from "./people";

function place(id: number, title: string, more: Partial<Feed> = {}): Feed {
  return { id, title, siteUrl: null, unread: 0, folders: [], person: null, place: "blog", addedAt: id, ...more };
}

function article(feedId: number, more: Partial<Article> = {}): Article {
  return { id: 1, feedId, feedTitle: "Alpha", title: "A post", link: null, at: 0, read: false, starred: false, muted: false, ...more };
}

describe("a person's row in the sidebar", () => {
  const blog = place(3, "Alpha's blog", { person: 9, unread: 2, folders: [1] });
  const channel = place(5, "Alpha on YouTube", { person: 9, unread: 4, folders: [2], place: "video" });
  const beta = place(4, "Beta's notebook", { unread: 1 });
  const people = [{ id: 9, name: "Alpha" }];

  it("is one row per person, under their name, opening their first place, A to Z", () => {
    const rows = rowsOf([blog, beta, channel], people);
    expect(rows.map((row) => row.title)).toEqual(["Alpha", "Beta's notebook"]);
    expect(rows[0]!.id).toBe(3);
    expect(rows[0]!.places).toEqual([3, 5]);
  });

  it("adds up its places' counts and sits in every folder any of them is in", () => {
    const [alpha] = rowsOf([blog, beta, channel], people);
    expect(alpha!.unread).toBe(6);
    expect(alpha!.folders).toEqual([1, 2]);
  });

  it("says checking… while any of its places waits for its first check (decision 0249)", () => {
    const waiting = { ...channel, waiting: true };
    expect(rowsOf([blog, beta, waiting], people)[0]!.waiting).toBe(true);
    expect(rowsOf([blog, beta, channel], people)[0]!.waiting).toBe(false);
  });

  it("stands for any of its places, and a place on its own is its own row, as before", () => {
    const rows = rowsOf([blog, beta, channel], people);
    expect(rowFor(5, rows)?.title).toBe("Alpha");
    expect(rowFor(4, rows)).toBe(beta);
    expect(placesOf(beta, [blog, beta, channel])).toEqual([beta]);
    expect(placesOf(channel, [blog, beta, channel]).map((each) => each.id)).toEqual([3, 5]);
  });
});

describe("a person's page", () => {
  it("names a blog by its website and a channel or newsletter by its own name", () => {
    expect(siteName("https://www.alpha.example/blog")).toBe("alpha.example");
    expect(siteName("not an address")).toBeUndefined();
    expect(placeShownAs(place(1, "Alpha's blog", { siteUrl: "https://alpha.example/" }))).toBe("alpha.example");
    expect(placeShownAs(place(1, "Alpha's blog"))).toBe("Alpha's blog");
    expect(placeShownAs(place(2, "Alpha on YouTube", { place: "video", siteUrl: "https://www.youtube.com/channel/x" }))).toBe("Alpha on YouTube");
  });
});

describe("the rows of a person's list", () => {
  it("say which place each article is from, when they have several", () => {
    const labels = placeLabels([place(3, "Alpha's blog"), place(5, "Alpha on YouTube", { place: "video" })]);
    expect(sourceOf(article(3), labels)).toBe("Blog");
    expect(sourceOf(article(5), labels)).toBe("Video");
    expect(sourceOf(article(3, { episode: true }), labels)).toBe("Podcast");
  });

  it("don't repeat a name in one place's own list, and credit the maker everywhere else", () => {
    expect(placeLabels([place(3, "Alpha's blog")])).toBe(true);
    expect(sourceOf(article(3), false)).toBe("Alpha");
  });
});

describe("a person's list on screen", () => {
  it("refreshes when the same person gains or loses a place, not when another person opens", () => {
    const changed = placesWatch();
    expect(changed(3, 1)).toBe(false);
    expect(changed(3, 2)).toBe(true);
    expect(changed(3, 2)).toBe(false);
    expect(changed(4, 1)).toBe(false);
    expect(changed(4, 1)).toBe(false);
  });
});

describe("a publication's writer in a list", () => {
  it("is named first, unless the publication is named for them", () => {
    expect(writerOf(article(3, { feedTitle: "Garden Letters", writer: "Lena Fischer" }))).toBe("Lena Fischer");
    expect(writerOf(article(3, { feedTitle: "Lena Fischer", writer: "lena fischer" }))).toBeUndefined();
    expect(writerOf(article(3))).toBeUndefined();
  });
});

describe("Unread, by person (decision 0271)", () => {
  const by = (id: number, whose: number, feedTitle: string, publication = false) => article(id, { id, whose, feedTitle, publication });

  it("names each person once, above their first article, and says where publications begin", () => {
    const listed = [by(1, -7, "Alpha"), by(2, -7, "Alpha"), by(3, 4, "Beta (beta@example.com)"), by(4, 5, "Garden Letters", true), by(5, 5, "Garden Letters", true), by(6, 6, "Open Field", true)];
    expect(headsOf(listed)).toEqual([
      { name: "Alpha", publications: false },
      undefined,
      { name: "Beta", publications: false },
      { name: "Garden Letters", publications: true },
      undefined,
      { name: "Open Field", publications: false },
    ]);
  });

  it("starts with Publications when there are no people", () => {
    expect(headsOf([by(1, 5, "Garden Letters", true)])).toEqual([{ name: "Garden Letters", publications: true }]);
  });

  it("doesn't name again a person carried on from the page before", () => {
    const pageOne = [by(1, -7, "Alpha"), by(2, -7, "Alpha")];
    const pageTwo = [by(3, -7, "Alpha"), by(4, 4, "Beta")];
    expect(headsOf([...pageOne, ...pageTwo]).map((head) => head?.name)).toEqual(["Alpha", undefined, undefined, "Beta"]);
  });

  it("names nobody in a list that isn't by person", () => {
    expect(headsOf([article(1), article(2)])).toEqual([undefined, undefined]);
  });
});
