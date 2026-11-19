import { afterEach, describe, expect, it, vi } from "vitest";
import { keepNewestPage, pageVersion, readCarried, switchesOnMove, verdict } from "./updates.svelte";

describe("telling a tab that nine turtles was updated", () => {
  it("says nothing while the versions match, or before the tab knows its own", () => {
    expect(verdict("2026-10-23-a", "2026-10-23-a", 200)).toBe("same");
    expect(verdict(undefined, "2026-10-23-a", 400)).toBe("same");
    expect(verdict("2026-10-23-a", null, 400)).toBe("same");
  });

  it("knows a newer version is ready when another version answers", () => {
    expect(verdict("2026-10-23-a", "2026-10-24-b", 200)).toBe("newer");
    // Signed out, or a refusal the screen explains: still just newer.
    expect(verdict("2026-10-23-a", "2026-10-24-b", 401)).toBe("newer");
    expect(verdict("2026-10-23-a", "2026-10-24-b", 409)).toBe("newer");
  });

  it("asks for a reload when the newer version didn't understand the request", () => {
    for (const status of [400, 404, 405, 415, 422]) {
      expect(verdict("2026-10-23-a", "2026-10-24-b", status)).toBe("stranded");
    }
  });
});

describe("switching an open tab to the new version", () => {
  it("switches on the next move once a newer version is ready", () => {
    expect(switchesOnMove(true, false, false)).toBe(true);
  });

  it("stays put while nothing newer is live", () => {
    expect(switchesOnMove(false, false, false)).toBe(false);
  });

  it("waits while marks are still being saved, so none is lost", () => {
    expect(switchesOnMove(true, true, false)).toBe(false);
  });

  it("waits while an Undo is on offer, so it isn't lost", () => {
    expect(switchesOnMove(true, false, true)).toBe(false);
  });
});

describe("what a switch carries to the new version", () => {
  const carried = { keyboard: true, lastPlace: "/feeds/3", sidebarScroll: 120 };

  it("reads back a note it wrote", () => {
    expect(readCarried(JSON.parse(JSON.stringify(carried)))).toEqual(carried);
  });

  // Decision 0282: the sidebar can't be hidden any more, so an older version's "hidden" never carries over.
  it("drops whether an older version had the sidebar hidden", () => {
    expect(readCarried({ ...carried, sidebar: "hidden" })).toEqual(carried);
  });

  it("ignores anything else", () => {
    expect(readCarried(null)).toBeUndefined();
    expect(readCarried("keyboard")).toBeUndefined();
    expect(readCarried({ ...carried, sidebarScroll: "far" })).toBeUndefined();
  });
});

describe("a tab left open when another reader signs in on the browser", () => {
  afterEach(() => vi.unstubAllGlobals());

  async function load() {
    vi.resetModules();
    return import("./updates.svelte");
  }

  it("names its reader on every request, once it knows it", async () => {
    const fetch = vi.fn(async (_input: string, _init?: RequestInit) => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    const { api, noteTabReader } = await load();
    await api("/api/articles/starred", { method: "POST", headers: { "content-type": "application/json" } });
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("x-nine-turtles-reader")).toBeNull();
    noteTabReader(7);
    await api("/api/articles/starred", { method: "POST", headers: { "content-type": "application/json" } });
    const sent = new Headers(fetch.mock.calls[1]?.[1]?.headers);
    expect(sent.get("x-nine-turtles-reader")).toBe("7");
    expect(sent.get("content-type")).toBe("application/json");
  });

  it("stops, says so and offers Reload when the server says the tab's reader isn't signed in here any more", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":"other-reader"}', { status: 409, headers: { "x-nine-turtles-other-reader": "1" } })),
    );
    const { OtherReader, api, noteTabReader, updates } = await load();
    noteTabReader(7);
    // Never handed back as an answer: 409 means other things to some callers.
    await expect(api("/api/articles/starred", { method: "POST" })).rejects.toBeInstanceOf(OtherReader);
    expect(updates.otherReader).toBe(true);
  });
});

describe("a page opened from the phone's kept copy knows its own version (decision 0320)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the version the server wrote into the page, and none where it wrote none", () => {
    const meta = (content: string | null) => ({ querySelector: () => (content === null ? null : { getAttribute: () => content }) });
    vi.stubGlobal("document", meta("2026-11-19-abc"));
    expect(pageVersion()).toBe("2026-11-19-abc");
    vi.stubGlobal("document", meta(""));
    expect(pageVersion()).toBeUndefined();
    vi.stubGlobal("document", meta(null));
    expect(pageVersion()).toBeUndefined();
  });

  it("puts the server's page in place of the kept one before a reload, and keeps the old one without an answer", async () => {
    const put = vi.fn();
    vi.stubGlobal("caches", { open: async () => ({ put }) });
    vi.stubGlobal("fetch", async () => new Response('<meta name="nine-turtles-version" content="new">'));
    await keepNewestPage();
    expect(put).toHaveBeenCalledWith("/", expect.any(Response));

    put.mockClear();
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    await keepNewestPage();
    // Not an error page, either: only the app's own page is ever kept.
    vi.stubGlobal("fetch", async () => new Response("<p>Bad gateway</p>", { status: 200 }));
    await keepNewestPage();
    expect(put).not.toHaveBeenCalled();
  });
});

