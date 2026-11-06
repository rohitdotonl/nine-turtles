import { describe, expect, it } from "vitest";
import type { Feed } from "./shapes";
import { addressFor, looksLikeAddress, replySubject, siteOf, writeBackLink, writesBack } from "./writeBack";

function place(id: number, changes: Partial<Feed> = {}): Feed {
  return { id, title: `Place ${id}`, siteUrl: null, unread: 0, folders: [], ...changes };
}

describe("writing back", () => {
  it("is for people only, never a publication", () => {
    expect(writesBack(place(1, { kind: "person" }))).toBe(true);
    expect(writesBack(place(2))).toBe(true);
    expect(writesBack(place(3, { kind: "publication" }))).toBe(false);
    expect(writesBack(undefined)).toBe(false);
  });

  it("writes to the reader's own address first, then this place's, then another place's", () => {
    const blog = place(1, { person: 7, addedAt: 1, email: "blog@alpha.example" });
    const letters = place(2, { person: 7, addedAt: 2, email: "letters@alpha.example" });
    expect(addressFor(letters, [blog, letters])).toBe("letters@alpha.example");
    expect(addressFor(place(2, { person: 7, addedAt: 2 }), [blog, place(2, { person: 7, addedAt: 2 })])).toBe("blog@alpha.example");
    const typed = place(2, { person: 7, addedAt: 2, writeTo: "alpha@home.example", email: "letters@alpha.example" });
    expect(addressFor(blog, [blog, typed])).toBe("alpha@home.example");
    expect(addressFor(place(3), [place(3)])).toBeUndefined();
  });

  it("says Re: once", () => {
    expect(replySubject("Walking home")).toBe("Re: Walking home");
    expect(replySubject("Re: Walking home")).toBe("Re: Walking home");
    expect(replySubject("RE: walking")).toBe("RE: walking");
    expect(replySubject("  ")).toBe("");
  });

  it("makes a link the email app opens, its parts kept whole", () => {
    expect(writeBackLink("alpha@alpha.example", "Tea & cake?")).toBe("mailto:alpha@alpha.example?subject=Re%3A%20Tea%20%26%20cake%3F");
    expect(writeBackLink("a+b@alpha.example", "")).toBe("mailto:a%2Bb@alpha.example");
  });

  it("tells one address from anything else", () => {
    for (const fine of ["alpha@alpha.example", " mailto:alpha@alpha.example ", "ålpha@bücher.example", "a.b+c@mail.alpha.co.uk"]) {
      expect(looksLikeAddress(fine), fine).toBe(true);
    }
    for (const wrong of ["", "alpha", "alpha@", "@alpha.example", "alpha@alpha", "al pha@alpha.example", "a@b.example, c@d.example", "a@@b.example", ".alpha@x.org", "alpha.@x.org", `${"a".repeat(65)}@x.org`, "alpha@-x.org", "alpha@x-.org", "a@b.example@c.example"]) {
      expect(looksLikeAddress(wrong), wrong).toBe(false);
    }
  });

  it("finds their site from the feed, else from the article's own home page", () => {
    expect(siteOf({ siteUrl: "https://alpha.example/blog/" }, "https://other.example/one")).toBe("https://alpha.example/blog/");
    expect(siteOf({ siteUrl: null }, "https://alpha.example/2026/11/one?ref=feed")).toBe("https://alpha.example/");
    expect(siteOf({ siteUrl: "javascript:alert(1)" }, null)).toBeUndefined();
    expect(siteOf(undefined, "not a link")).toBeUndefined();
  });
});
