import { afterEach, describe, expect, it, vi } from "vitest";
import { keptList, NeedsConnection, RECENT_NEEDS_CONNECTION } from "./offline";
import { nameFor, parse, pathFor } from "./router";
import { scopeFor } from "./search";

// Recently read, hiding lists from the sidebar, and how often a feed posts
// (decision 0105). Each test that talks to the server loads feeds.ts afresh.
async function load() {
  vi.resetModules();
  return import("./feeds");
}

/** A fetch that answers every request with `body`, and remembers what it was sent. */
function server(body: unknown) {
  const sent: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      sent.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe("Recently read", () => {
  it("has its own address and name", () => {
    expect(parse("/recent")).toEqual({ kind: "view", view: "recent" });
    expect(pathFor({ kind: "view", view: "recent" })).toBe("/recent");
    expect(nameFor({ kind: "view", view: "recent" })).toBe("Recently read");
  });

  it("searches everything, as All does", () => {
    expect(scopeFor({ kind: "view", view: "recent" })).toEqual({ kind: "all" });
  });

  it("isn't kept on the device, so without a connection it says so", () => {
    expect(() => keptList([], { view: "recent" }, "newest")).toThrow(NeedsConnection);
    expect(() => keptList([], { view: "recent" }, "newest")).toThrow(RECENT_NEEDS_CONNECTION);
  });

  it("is told when an article is opened, and lists it after", async () => {
    const sent = server({ articles: [], next: null, latest: 0 });
    const { noteOpened, listArticles } = await load();
    noteOpened(7);
    await listArticles({ view: "recent" }, "newest", null);
    expect(sent.map((each) => each.path)).toEqual(["/api/articles/opened", "/api/articles?view=recent&order=newest"]);
    expect(sent[0]?.body).toEqual({ id: 7 });
  });

  it("sends nothing without a connection", async () => {
    const sent = server({});
    vi.stubGlobal("navigator", { onLine: false });
    const { noteOpened } = await load();
    noteOpened(7);
    expect(sent).toEqual([]);
  });
});

describe("lists hidden from the sidebar", () => {
  it("are read in one order, leaving out anything not understood", async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
    server({ sort: "newest", mode: "inbox", counts: "shown", let_go: "never", hidden: ["searches", "unread", "recent", "later"] });
    const { loadSettings, lastHidden } = await load();
    expect((await loadSettings()).hidden).toEqual(["recent", "searches"]);
    // This device remembers, so the lists don't flash before the server answers.
    expect(lastHidden()).toEqual(["recent", "searches"]);
  });

  it("are saved on their own", async () => {
    const sent = server({});
    const { saveHidden } = await load();
    await saveHidden(["starred"]);
    expect(sent.map((each) => each.body)).toEqual([{ hidden: ["starred"] }]);
  });
});

describe("how often a feed posts", () => {
  it("is the server's words, or nothing if it can't say", async () => {
    server({ words: "Posts about 3 times a week" });
    let { feedFrequency } = await load();
    expect(await feedFrequency(3)).toBe("Posts about 3 times a week");

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    ({ feedFrequency } = await load());
    expect(await feedFrequency(3)).toBeUndefined();
  });
});
