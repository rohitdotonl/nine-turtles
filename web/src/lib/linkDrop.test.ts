import { describe, expect, it } from "vitest";
import { droppedAddress, feedListFile, holding } from "./linkDrop.svelte";

// Following by dropping (SPEC section 3, decision 0246).
const carrying = (text: string) => ({ getData: (kind: string) => (kind === "text/uri-list" ? text : "") });
const OURS = "https://app.nineturtles.app";

describe("what a drop on nine turtles carries", () => {
  it("takes the first web address of a link or another tab", () => {
    expect(droppedAddress(carrying("https://lowtide.example/blog/"), OURS)).toBe("https://lowtide.example/blog/");
    expect(droppedAddress(carrying("# a comment\r\nhttps://a.example/\r\nhttps://b.example/"), OURS)).toBe("https://a.example/");
  });

  it("leaves anything that isn't a web page's address", () => {
    expect(droppedAddress(carrying(""), OURS)).toBeUndefined();
    expect(droppedAddress(carrying("mailto:hello@example.com"), OURS)).toBeUndefined();
    expect(droppedAddress(carrying("not an address"), OURS)).toBeUndefined();
    expect(droppedAddress(null, OURS)).toBeUndefined();
  });

  it("leaves nine turtles' own links (a row dragged inside the app)", () => {
    expect(droppedAddress(carrying(`${OURS}/people/3`), OURS)).toBeUndefined();
  });

  it("takes a list of feeds only by its name's ending", () => {
    const file = (name: string) => new File(["<opml/>"], name);
    expect(feedListFile([file("feeds.opml")])?.name).toBe("feeds.opml");
    expect(feedListFile([file("Subscriptions.XML")])?.name).toBe("Subscriptions.XML");
    expect(feedListFile([file("photo.jpg")])).toBeUndefined();
    expect(feedListFile([])).toBeUndefined();
  });

  it("tells a held file from a held link by the drag's types", () => {
    expect(holding(["text/uri-list", "text/plain"])).toBe("link");
    expect(holding(["Files"])).toBe("file");
    expect(holding(["text/plain"])).toBeUndefined();
    expect(holding(undefined)).toBeUndefined();
  });
});
