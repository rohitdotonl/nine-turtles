import { afterEach, describe, expect, it, vi } from "vitest";

// Pick up where you left off (SPEC section 7, decision 0174). Each test loads
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
    const { askWhereYouLeftOff, pickUp, articleOpened, placeOf } = await load();
    askWhereYouLeftOff();
    askWhereYouLeftOff();
    await settle();
    expect(sent).toEqual(["GET /api/resume"]);
    expect(pickUp.asked).toBe(true);
    expect(pickUp.offer?.article.id).toBe(7);
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
    expect(sent.at(-1)).toBe("DELETE /api/resume?id=7");
    placeKept(8, { block: 2, within: 0.25 });
    expect(sent.at(-1)).toBe('PUT /api/resume {"id":8,"block":2,"within":0.25}');
    placeKept(8, undefined);
    expect(sent.at(-1)).toBe("DELETE /api/resume?id=8");
  });

  it("isn't offered when something opened before the answer came, and that place is let go", async () => {
    storage();
    const sent = server({ article: ARTICLE, writer: null, block: 3, within: 0.5 });
    const { pickUp, articleOpened } = await load();
    articleOpened(8);
    await settle();
    expect(pickUp.offer).toBeUndefined();
    expect(sent).toEqual(["GET /api/resume", "DELETE /api/resume?id=7"]);
  });

  it("sends nothing without a connection", async () => {
    const sent = server(null);
    vi.stubGlobal("navigator", { onLine: false });
    const { placeKept } = await load();
    placeKept(8, { block: 2, within: 0.25 });
    expect(sent).toEqual([]);
  });
});
