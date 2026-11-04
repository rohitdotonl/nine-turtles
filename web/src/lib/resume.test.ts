import { afterEach, describe, expect, it, vi } from "vitest";

// Pick up where you left off (SPEC section 7, decision 0175). Each test loads
// the file afresh, as a page load would.
async function load() {
  vi.resetModules();
  return { ...(await import("./resume.svelte")), ...(await import("./places")) };
}

const ARTICLE = { id: 7, feed_id: 1, feed_title: "Quiet Notes", title: "The long walk home", link: null, at: 0, read: true, starred: false, muted: false };

/** A fetch that answers `/api/resume` with `offer`, and remembers each request's method and path. */
function server(offer: unknown) {
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      sent.push(`${init?.method ?? "GET"} ${path}${init?.body ? ` ${String(init.body)}` : ""}`);
      return new Response(init?.method ? null : JSON.stringify(offer), { status: init?.method ? 204 : 200, headers: { "content-type": "application/json" } });
    }),
  );
  return sent;
}

/** Lets the answers on their way arrive. */
const settle = () => new Promise((done) => setTimeout(done, 0));

/** A storage that keeps what's put in it, for the device's places. */
function storage() {
  const kept = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => kept.set(key, value), removeItem: (key: string) => kept.delete(key) });
}

afterEach(() => vi.unstubAllGlobals());

describe("Pick up where you left off", () => {
  it("reads the server's offer, and nothing that isn't well formed", async () => {
    const { toOffer } = await load();
    const offer = toOffer({ article: ARTICLE, writer: " Ana ", block: 3, within: 0.5 });
    expect(offer?.article.title).toBe("The long walk home");
    expect(offer?.writer).toBe("Ana");
    expect(offer?.place).toEqual({ block: 3, within: 0.5 });
    expect(toOffer({ article: ARTICLE, writer: "", block: 3, within: 0.5 })?.writer).toBeNull();
    for (const broken of [null, {}, { article: ARTICLE, block: -1, within: 0 }, { article: ARTICLE, block: 1.5, within: 0 }, { article: ARTICLE, block: 1, within: 2 }]) {
      expect(toOffer(broken)).toBeUndefined();
    }
  });

  it("says who wrote it when that's known, else the title alone", async () => {
    const { pickUpWords, toOffer } = await load();
    const signed = toOffer({ article: ARTICLE, writer: "Ana", block: 1, within: 0 })!;
    expect(pickUpWords(signed)).toEqual({ before: "You were reading ", after: ", by Ana." });
    expect(pickUpWords({ ...signed, writer: null })).toEqual({ before: "You were reading ", after: "." });
  });

  it("offers the article, keeps its place on this device too, and goes once it opens", async () => {
    storage();
    const sent = server({ article: ARTICLE, writer: "Ana", block: 3, within: 0.5 });
    const { askWhereYouLeftOff, pickUp, articleOpened, placeOf, keepPlace } = await load();
    keepPlace(7, { block: 1, within: 0 });
    askWhereYouLeftOff();
    askWhereYouLeftOff();
    await settle();
    expect(sent).toEqual(["GET /api/resume"]);
    expect(pickUp.asked).toBe(true);
    expect(pickUp.offer?.article.id).toBe(7);
    // The server's place is the newest: it replaces this device's older one.
    expect(placeOf(7)).toEqual({ block: 3, within: 0.5 });
    articleOpened(7);
    expect(pickUp.offer).toBeUndefined();
    expect(sent).toEqual(["GET /api/resume"]);
  });

  it("lets the place go when something else opens, or the article's top or end is reached", async () => {
    storage();
    const sent = server({ article: ARTICLE, writer: null, block: 3, within: 0.5 });
    const { askWhereYouLeftOff, pickUp, articleOpened, placeKept } = await load();
    askWhereYouLeftOff();
    await settle();
    articleOpened(8);
    expect(pickUp.offer).toBeUndefined();
    await settle();
    expect(sent.at(-1)).toBe("DELETE /api/resume?id=7");
    placeKept(8, { block: 2, within: 0.25 });
    await settle();
    expect(sent.at(-1)).toBe('PUT /api/resume {"id":8,"block":2,"within":0.25}');
    placeKept(8, undefined);
    await settle();
    expect(sent.at(-1)).toBe("DELETE /api/resume?id=8");
  });

  it("isn't offered when something opened before the answer came, and that place is let go", async () => {
    storage();
    const sent = server({ article: ARTICLE, writer: null, block: 3, within: 0.5 });
    const { pickUp, articleOpened } = await load();
    articleOpened(8);
    await settle();
    expect(pickUp.offer).toBeUndefined();
    await settle();
    expect(sent).toEqual(["GET /api/resume", "DELETE /api/resume?id=7"]);
  });

  it("sends keep and let go one after another, in the order they were made", async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init?: RequestInit) => {
        order.push(`${init?.method} ${path}`);
        // The first request is slow: the second must wait for it.
        if (order.length === 1) await new Promise<void>((done) => (release = done));
        return new Response(null, { status: 204 });
      }),
    );
    const { placeKept } = await load();
    placeKept(8, { block: 2, within: 0.25 });
    placeKept(8, undefined);
    await settle();
    expect(order).toEqual(["PUT /api/resume"]);
    release();
    await settle();
    expect(order).toEqual(["PUT /api/resume", "DELETE /api/resume?id=8"]);
  });

  it("shows the usual line if the server is slow to answer, and a late answer doesn't replace it", async () => {
    vi.useFakeTimers();
    storage();
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => (answer = done))));
    const { askWhereYouLeftOff, pickUp, WAIT } = await load();
    askWhereYouLeftOff();
    expect(pickUp.asked).toBe(false);
    vi.advanceTimersByTime(WAIT);
    expect(pickUp.asked).toBe(true);
    answer(new Response(JSON.stringify({ article: ARTICLE, writer: null, block: 3, within: 0.5 }), { status: 200 }));
    vi.useRealTimers();
    await settle();
    expect(pickUp.offer).toBeUndefined();
  });

  it("sends nothing without a connection", async () => {
    const sent = server(null);
    vi.stubGlobal("navigator", { onLine: false });
    const { placeKept } = await load();
    placeKept(8, { block: 2, within: 0.25 });
    await settle();
    expect(sent).toEqual([]);
  });
});
