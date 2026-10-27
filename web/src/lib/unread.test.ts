import { afterEach, describe, expect, it, vi } from "vitest";

// Easing unread guilt (decision 0097): Catch me up, unread that lets go, and
// counts that can hide. Each test loads feeds.ts afresh.
async function load() {
  vi.resetModules();
  return import("./feeds");
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

describe("catch me up", () => {
  it("asks for everything before the start of today on this device's clock, and answers which", async () => {
    const sent = server({ ids: [4, 5, 6] });
    const { catchUp } = await load();
    const now = new Date(2026, 9, 26, 15, 30);
    expect(await catchUp(now)).toEqual([4, 5, 6]);
    expect(sent).toEqual([{ path: "/api/articles/catch-up", body: { before: new Date(2026, 9, 26).getTime() / 1000 } }]);
  });

  it("undoes a huge backlog in parts the server takes", async () => {
    const sent = server({ marked: 0 });
    const { uncatchUp } = await load();
    const ids = Array.from({ length: 25_000 }, (_, index) => index + 1);
    await uncatchUp(ids);
    expect(sent.map((each) => (each.body as { ids: number[] }).ids.length)).toEqual([10_000, 10_000, 5_000]);
    expect(sent.every((each) => (each.body as { read: boolean }).read === false)).toBe(true);
  });

  it("says what it did in plain words", async () => {
    const { caughtUpMessage } = await load();
    expect(caughtUpMessage(1)).toBe("Marked 1 item from before today as read");
    expect(caughtUpMessage(230)).toBe("Marked 230 items from before today as read");
    expect(caughtUpMessage(0)).toBe("Nothing from before today is unread.");
  });
});

describe("the reading settings", () => {
  it("read the counts and the wait, with calm defaults for anything not understood", async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
    server({ sort: "oldest", mode: "inbox", counts: "hidden", let_go: "two-weeks", keys: { star: "x", odd: 3 } });
    let { loadSettings, lastCounts, lastKeys } = await load();
    expect(await loadSettings()).toEqual({ sort: "oldest", mode: "inbox", counts: "hidden", letGo: "two-weeks", keys: { star: "x" } });
    // This device remembers the counts were hidden, so they don't flash before the server answers,
    // and the reader's keys (decision 0110), so a changed key works from the first press.
    expect(lastCounts()).toBe("hidden");
    expect(lastKeys()).toEqual({ star: "x" });

    server({ sort: "newest", mode: "inbox", counts: "sideways", let_go: "someday" });
    ({ loadSettings } = await load());
    expect(await loadSettings()).toEqual({ sort: "newest", mode: "inbox", counts: "shown", letGo: "never", keys: {} });

    // Unreachable: the wait is unknown, so its choices wait rather than show Never; the keys are this device's.
    stored.set("nine-turtles.keys", JSON.stringify({ star: "z" }));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    ({ loadSettings } = await load());
    const offline = await loadSettings();
    expect(offline.letGo).toBeUndefined();
    expect(offline.keys).toEqual({ star: "z" });
  });

  it("save each setting on its own", async () => {
    const sent = server({});
    const { saveCounts, saveLetGo, saveKeys } = await load();
    await saveCounts("hidden");
    await saveLetGo("month");
    await saveKeys({ star: "x" });
    expect(sent.map((each) => each.body)).toEqual([{ counts: "hidden" }, { let_go: "month" }, { keys: { star: "x" } }]);
  });
});
