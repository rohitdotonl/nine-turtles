import { describe, expect, it } from "vitest";
import { chosenPicture, iconsOf, initialsOf, picturesOf } from "./portrait";
import type { Feed } from "./shapes";

const place = (id: number, more: Partial<Feed> = {}): Feed => ({ id, title: "Mara Quill", siteUrl: null, unread: 0, folders: [], ...more });

describe("a person's or publication's picture (decision 0283)", () => {
  it("falls back to two initials for a person, one for a publication", () => {
    expect(initialsOf("Steph Ango", true)).toBe("SA");
    expect(initialsOf("Susan B. Glasser", true)).toBe("SG");
    expect(initialsOf("Every", false)).toBe("E");
    expect(initialsOf("The New Yorker", false)).toBe("N");
    expect(initialsOf("xkcd.com", true)).toBe("X");
    expect(initialsOf("émile zola", true)).toBe("ÉZ");
    expect(initialsOf("  ", true)).toBe("?");
  });

  it("asks a site for its home-screen icon, then its tab icon, and nothing that isn't a web address", () => {
    expect(iconsOf("https://stephango.com/notes")).toEqual(["https://stephango.com/apple-touch-icon.png", "https://stephango.com/favicon.ico"]);
    expect(iconsOf("javascript:alert(1)")).toEqual([]);
    expect(iconsOf(null)).toEqual([]);
  });

  it("tries the chosen picture first, then the feed's own, then the site's icons, each once", () => {
    const places = [
      place(1, { siteUrl: "https://quill.example/", pictureUrl: "https://quill.example/mara.jpg" }),
      place(2, { siteUrl: "https://quill.example/podcast", pictureChosen: 1700000000 }),
    ];
    expect(chosenPicture(places)).toBe("/api/feeds/2/picture?v=1700000000");
    expect(picturesOf(places, "https://quill.example/ink")).toEqual([
      "/api/feeds/2/picture?v=1700000000",
      "https://quill.example/mara.jpg",
      "https://quill.example/apple-touch-icon.png",
      "https://quill.example/favicon.ico",
    ]);
    expect(picturesOf([], null)).toEqual([]);
  });
});
