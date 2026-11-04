import { describe, expect, it } from "vitest";
import type { Article, Feed } from "./shapes";
import { firstNameOf, followingSince, placeLabels, placeShownAs, placesOf, placesWatch, rowFor, rowsOf, siteName, sourceOf } from "./people";

function place(id: number, title: string, more: Partial<Feed> = {}): Feed {
  return { id, title, siteUrl: null, unread: 0, folders: [], check: "automatic", openOnSite: false, person: null, place: "blog", addedAt: id, ...more };
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

  it("says since when, by the month their first place was followed", () => {
    const march = Date.UTC(2026, 2, 14) / 1000;
    const now = new Date(Date.UTC(2026, 10, 2));
    expect(followingSince([place(1, "a", { addedAt: march + 999 }), place(2, "b", { addedAt: march })], now)).toBe("since March 2026");
    expect(followingSince([place(1, "a", { addedAt: now.getTime() / 1000 })], now)).toBe("since this month");
    expect(followingSince([], now)).toBeUndefined();
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

describe("what Write back calls someone", () => {
  const tomas = place(1, "Tomas Berg", { siteTitle: "Notes from Tomas", kind: "person" });

  it("is a person's first name, when their name is their own", () => {
    expect(firstNameOf("Tomas Berg", [tomas])).toBe("Tomas");
    expect(firstNameOf("Ana María López-Ruiz", [tomas])).toBe("Ana");
  });

  it("is the whole name when it's a blog's title, a publication's, one word or not a name", () => {
    expect(firstNameOf("Notes From Tomas", [place(2, "Notes From Tomas", { siteTitle: "Notes From Tomas" })])).toBe("Notes From Tomas");
    expect(firstNameOf("Tomas Berg", [{ ...tomas, kind: "publication" }])).toBe("Tomas Berg");
    expect(firstNameOf("Alpha", [tomas])).toBe("Alpha");
    expect(firstNameOf("the morning paper", [tomas])).toBe("the morning paper");
    expect(firstNameOf("Field Notes 2026", [tomas])).toBe("Field Notes 2026");
  });
});
