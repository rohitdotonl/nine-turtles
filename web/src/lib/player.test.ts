import { afterEach, describe, expect, it, vi } from "vitest";

/** A fetch whose answers wait until the test lets each one go, in any order. */
function slowServer() {
  const waiting: { order: number[]; answer: (status: number) => void }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init?: RequestInit) => {
      const order = (JSON.parse(String(init?.body)) as { articles: number[] }).articles;
      return new Promise<Response>((resolve) => {
        waiting.push({
          order,
          answer: (status) => resolve(new Response(JSON.stringify({ articles: order }), { status })),
        });
      });
    }),
  );
  return {
    sent: () => waiting.map((each) => each.order),
    answer(index: number, status: number) {
      const each = waiting[index];
      if (!each) throw new Error(`no save number ${index} on its way`);
      each.answer(status);
    },
  };
}

/** Lets pending promises run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function load() {
  vi.resetModules();
  return import("./player.svelte");
}

afterEach(() => vi.unstubAllGlobals());

describe("Up Next when two changes are on their way at once (survey A8)", () => {
  it("keeps the newer order when the older answer comes back last", async () => {
    const server = slowServer();
    const { player, changeUpNext } = await load();
    player.upNext = [1, 2, 3];
    const first = changeUpNext([2, 1, 3]);
    const second = changeUpNext([2, 3, 1]);
    await settle();
    // The second waits for the first, so the server sees them in the order made.
    expect(server.sent()).toEqual([[2, 1, 3]]);
    server.answer(0, 200);
    await settle();
    server.answer(1, 200);
    await Promise.all([first, second]);
    expect(player.upNext).toEqual([2, 3, 1]);
  });

  it("doesn't undo a newer change when an older one fails", async () => {
    const server = slowServer();
    const { player, changeUpNext } = await load();
    player.upNext = [1, 2, 3];
    const first = changeUpNext([2, 1, 3]);
    const second = changeUpNext([2, 3, 1]);
    await settle();
    server.answer(0, 500);
    await settle();
    expect(player.upNext).toEqual([2, 3, 1]);
    server.answer(1, 200);
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(player.upNext).toEqual([2, 3, 1]);
  });

  it("goes back to what the server last kept when the newest change fails", async () => {
    const server = slowServer();
    const { player, changeUpNext } = await load();
    player.upNext = [1, 2, 3];
    const first = changeUpNext([2, 1, 3]);
    const second = changeUpNext([2, 3, 1]);
    await settle();
    server.answer(0, 200);
    await settle();
    server.answer(1, 500);
    await Promise.all([first, second]);
    expect(player.upNext).toEqual([2, 1, 3]);
  });
});
