import { afterEach, describe, expect, it } from "vitest";
import { articleAddress, namePlaces } from "./addressing";
import { addressFor } from "./router";
import type { Article, Feed } from "./shapes";

// The words in addresses (decision 0281), from the sidebar's names.

function place(id: number, title: string, more: Partial<Feed> = {}): Feed {
  return { id, title, siteUrl: null, unread: 0, folders: [], person: null, place: "blog", addedAt: id, ...more };
}

function article(feedId: number, more: Partial<Article> = {}): Article {
  return { id: 29, feedId, feedTitle: "Mira's blog", title: "A slow letter", link: null, at: 0, read: false, starred: false, muted: false, ...more };
}

// A person of two places, under their own name; a blog on its own.
const mira = { ...place(3, "Mira Chen"), places: [3, 5] };
const rows = [mira, place(7, "Quiet Notes")];

afterEach(() => void namePlaces(undefined, []));

describe("addresses with the sidebar's names", () => {
  it("names people, publications and folders once the sidebar has loaded", () => {
    expect(namePlaces(undefined, [])).toBe(false);
    expect(addressFor({ kind: "feed", id: 3 })).toBe("/3");
    expect(namePlaces(rows, [{ id: 4, name: "Friends" }])).toBe(true);
    expect(addressFor({ kind: "feed", id: 3 })).toBe("/mira-chen-3");
    expect(addressFor({ kind: "about", id: 7 })).toBe("/quiet-notes-7/about");
    expect(addressFor({ kind: "folder", id: 4 })).toBe("/folders/friends-4");
  });

  it("gives an article its title in its writer's list, and their name first in any other", () => {
    namePlaces(rows, [{ id: 4, name: "Friends" }]);
    // From either of Mira's places, her list is hers.
    expect(articleAddress(article(5), { kind: "feed", id: 3 }, rows)).toBe("/mira-chen-3/a-slow-letter-29");
    expect(articleAddress(article(5), { kind: "view", view: "unread" }, rows)).toBe("/unread/mira-chen/a-slow-letter-29");
    expect(articleAddress(article(7), { kind: "folder", id: 4 }, rows)).toBe("/folders/friends-4/quiet-notes/a-slow-letter-29");
    // An untitled post goes by its opening words; a place not in the sidebar by the feed's own title.
    expect(articleAddress(article(9, { title: " ", opening: "Saw the first heron." }), { kind: "view", view: "all" }, rows)).toBe("/all/miras-blog/saw-the-first-heron-29");
  });
});
