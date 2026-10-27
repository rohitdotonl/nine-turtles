import { afterEach, describe, expect, it, vi } from "vitest";
import { byName, deleteCollection, makeCollection, putBack, refusedCollection, saveCollectionsOf, takenOff, toCollections } from "./collections";
import { parse, pathFor, titleFor } from "./router";
import { keptList } from "./offline";

/** Answers every request with this status and body, and keeps what was asked. */
function server(status: number, body: unknown) {
  const asked: { url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    asked.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  });
  return asked;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("collections", () => {
  it("are read safely, and kept A to Z whatever the capitals", () => {
    expect(toCollections([{ id: 2, name: "to cite" }, { id: "x", name: "Odd" }, { id: 3 }, null, { id: 1, name: "Recipes" }])).toEqual([
      { id: 2, name: "to cite" },
      { id: 1, name: "Recipes" },
    ]);
    expect(toCollections(undefined)).toEqual([]);
    const sorted = [
      { id: 2, name: "to cite" },
      { id: 1, name: "Recipes" },
      { id: 3, name: "apples" },
    ].sort(byName);
    expect(sorted.map((each) => each.name)).toEqual(["apples", "Recipes", "to cite"]);
  });

  it("have their own address", () => {
    expect(parse("/collections/3")).toEqual({ kind: "collection", id: 3 });
    expect(pathFor({ kind: "collection", id: 3 })).toBe("/collections/3");
    expect(titleFor({ kind: "collection", id: 3 }, "Recipes")).toBe("Recipes · nine turtles");
    expect(parse("/collections/0")).toEqual({ kind: "view", view: "unread" });
  });

  it("say plainly why one wasn't saved", async () => {
    server(409, { error: "already" });
    expect(await makeCollection("Recipes")).toBe("already");
    expect(refusedCollection("already")).toBe("There's already a collection with that name.");
    server(400, { error: "no-name" });
    expect(await makeCollection(" ")).toBe("no-name");
    server(404, null);
    expect(await saveCollectionsOf(9, [1])).toBe("gone");
  });

  it("are made with the articles and saved searches Undo gives back, and deleting answers them", async () => {
    let asked = server(201, { collection: { id: 6, name: "Recipes" } });
    expect(await makeCollection("Recipes", { articles: [11, 12], searches: [4] })).toEqual({ id: 6, name: "Recipes" });
    expect(asked[0]).toEqual({ url: "/api/collections", body: { name: "Recipes", articles: [11, 12], searches: [4] } });
    asked = server(200, { articles: [11, 12], searches: [4] });
    expect(await deleteCollection(6)).toEqual({ articles: [11, 12], searches: [4] });
    expect(asked[0]?.url).toBe("/api/collections/6/delete");
  });

  it("say which collections a Save took an article off, so Undo can put it back", async () => {
    const shelves = [
      { id: 1, name: "Recipes" },
      { id: 2, name: "To cite" },
      { id: 3, name: "Someday" },
    ];
    expect(takenOff({ article: 9, before: [1], after: [1, 2] }, shelves)).toBeUndefined();
    expect(takenOff({ article: 9, before: [1, 2], after: [2, 3] }, shelves)).toEqual({ ids: [1], message: "Took the article off Recipes" });
    expect(takenOff({ article: 9, before: [1, 2, 3], after: [] }, shelves)).toEqual({
      ids: [1, 3, 2],
      message: "Took the article off 3 collections",
    });
    // Undo keeps what the article is on now, and adds back what was taken off.
    const asked: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      asked.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const body = init?.method === "POST" ? {} : { collections: [3] };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    });
    expect(await putBack(9, [1])).toBeUndefined();
    expect(asked.at(-1)).toEqual({ url: "/api/articles/9/collections", body: { collections: [3, 1] } });
  });

  it("need a connection to open", () => {
    expect(() => keptList([], { collection: 3 }, "newest")).toThrow("Collections need a connection.");
  });
});
