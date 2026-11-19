import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FullArticle } from "./shapes";

const device = vi.hoisted(() => ({ keptArticle: vi.fn(), getJson: vi.fn() }));
vi.mock("./offline", () => ({ keptArticle: device.keptArticle }));
vi.mock("./http", async (actual) => ({ ...(await actual<typeof import("./http")>()), getJson: device.getJson }));
const { forgetLoaded, onFresher, readArticle, articleNow } = await import("./articles");

/** A promise answered later, by the test. */
function later<T>() {
  let answer!: (value: T) => void;
  const promise = new Promise<T>((resolve) => (answer = resolve));
  return { promise, answer };
}

const copy = (id: number, content: string) => ({ id, title: "On the device", content, summary: null }) as unknown as FullArticle;
const fromServer = (id: number) => ({ article: { id, feed_id: 1, title: "From the server", content: "<p>Words</p>", at: 0 } });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  forgetLoaded();
  device.keptArticle.mockReset();
  device.getJson.mockReset();
});

describe("opening an article this device keeps (decision 0314)", () => {
  it("opens at once from a whole copy, and the server's answer replaces it, telling who listens", async () => {
    const server = later<unknown>();
    device.getJson.mockReturnValue(server.promise);
    device.keptArticle.mockResolvedValue(copy(1, "<p>Words</p>"));
    const heard = vi.fn();
    const stop = onFresher(heard);

    expect((await readArticle(1)).title).toBe("On the device");
    expect(heard).not.toHaveBeenCalled();
    server.answer(fromServer(1));
    await settle();
    expect(articleNow(1)?.title).toBe("From the server");
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
  });

  it("waits for the server when the copy left pictures out", async () => {
    const server = later<unknown>();
    device.getJson.mockReturnValue(server.promise);
    device.keptArticle.mockResolvedValue(copy(2, '<p class="offline-image">A picture</p>'));
    let opened: FullArticle | undefined;
    void readArticle(2).then((article) => (opened = article));
    await settle();
    expect(opened).toBeUndefined();
    server.answer(fromServer(2));
    await settle();
    expect(opened?.title).toBe("From the server");
  });

  it("asks the server alone when there's no copy", async () => {
    device.getJson.mockResolvedValue(fromServer(3));
    device.keptArticle.mockResolvedValue(undefined);
    expect((await readArticle(3)).title).toBe("From the server");
  });

  it("keeps nothing for the next reader once another signs in", async () => {
    const server = later<unknown>();
    device.getJson.mockReturnValue(server.promise);
    device.keptArticle.mockResolvedValue(copy(4, "<p>Words</p>"));
    await readArticle(4);
    forgetLoaded();
    server.answer(fromServer(4));
    await settle();
    expect(articleNow(4)).toBeUndefined();
  });
});
