import { describe, expect, it } from "vitest";
import { headingFor, placeNameOf, type HeadingScene } from "./listHeading";

/** The All view, nothing missing, no results showing. */
function scene(changes: Partial<HeadingScene> = {}): HeadingScene {
  return {
    under: { kind: "view", view: "all" },
    placeName: undefined,
    missing: undefined,
    results: undefined,
    names: { feeds: [], folders: [{ id: 4, name: "Essays" }] },
    ...changes,
  };
}

describe("placeNameOf", () => {
  it("names the feed or folder the address names", () => {
    expect(placeNameOf({ feed: { title: "Quiet Notes" } })).toBe("Quiet Notes");
    expect(placeNameOf({ folder: { name: "Essays" } })).toBe("Essays");
    expect(placeNameOf({})).toBeUndefined();
  });

  it("prefers the feed, then the folder", () => {
    expect(placeNameOf({ feed: { title: "Quiet Notes" }, folder: { name: "Essays" } })).toBe("Quiet Notes");
  });
});

describe("headingFor", () => {
  it("names a view, or a place by its own name", () => {
    expect(headingFor(scene())).toBe("All articles");
    expect(headingFor(scene({ under: { kind: "feed", id: 3 }, placeName: "Quiet Notes" }))).toBe("Quiet Notes");
    expect(headingFor(scene({ under: { kind: "feed", id: 3 } }))).toBe("Someone");
  });

  it("says a place the reader doesn't have isn't found, even while results show", () => {
    expect(headingFor(scene({ under: { kind: "folder", id: 9 }, missing: "folder" }))).toBe("Folder not found");
    expect(headingFor(scene({ under: { kind: "folder", id: 9 }, missing: "folder", results: { kind: "all" } }))).toBe("Folder not found");
  });

  it("names where a search's results come from", () => {
    expect(headingFor(scene({ results: { kind: "all" } }))).toBe("Results in All articles");
    expect(headingFor(scene({ results: { kind: "folder", id: 4 } }))).toBe("Results in Essays");
  });
});
