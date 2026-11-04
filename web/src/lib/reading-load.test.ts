import { afterEach, describe, expect, it, vi } from "vitest";

// The reading settings shared across devices. Each test loads reading.ts afresh.
async function load() {
  vi.resetModules();
  return await import("./reading");
}

/** A fetch that answers every request with `body`, and remembers what it was sent. */
function server(body: unknown) {
  const sent: { path: string; body: unknown }[] = [];
  const fetch = vi.fn(async (path: string, init?: RequestInit) => {
    sent.push({ path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetch);
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe("the reading settings", () => {
  it("read the sort order, with calm defaults for anything not understood", async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) });
    server({ sort: "oldest", unread: true });
    let { loadSettings } = await load();
    expect(await loadSettings()).toEqual({ sort: "oldest", unread: true, hidden: [] });

    server({ sort: "sideways", unread: false });
    ({ loadSettings } = await load());
    expect(await loadSettings()).toEqual({ sort: "newest", unread: false, hidden: [] });

    // Unreachable: newest first, and Unread is as this device last saw it.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    ({ loadSettings } = await load());
    const offline = await loadSettings();
    expect(offline.sort).toBe("newest");
    expect(offline.unread).toBe(false);
  });

  it("save each setting on its own", async () => {
    const sent = server({});
    const { saveSort, saveUnread } = await load();
    await saveSort("oldest");
    await saveUnread(false);
    expect(sent.map((each) => each.body)).toEqual([{ sort: "oldest" }, { unread: false }]);
  });
});
