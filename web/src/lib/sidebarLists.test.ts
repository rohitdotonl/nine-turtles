import { afterEach, describe, expect, it, vi } from "vitest";

// Hiding lists from the sidebar, and how often a feed posts (decision 0105).
// Each test loads its files afresh.
async function load() {
  vi.resetModules();
  return { ...(await import("./feeds")), ...(await import("./reading")) };
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

describe("lists hidden from the sidebar", () => {
  it("are read in one order, leaving out anything not understood", async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
    server({ sort: "newest", hidden: ["all", "unread", "recent", "starred", "later"] });
    const { loadSettings, lastHidden } = await load();
    expect((await loadSettings()).hidden).toEqual(["starred", "all"]);
    // This device remembers, so the lists don't flash before the server answers.
    expect(lastHidden()).toEqual(["starred", "all"]);
  });

  it("are saved on their own", async () => {
    const sent = server({});
    const { saveHidden } = await load();
    await saveHidden(["starred"]);
    expect(sent.map((each) => each.body)).toEqual([{ hidden: ["starred"] }]);
  });
});
