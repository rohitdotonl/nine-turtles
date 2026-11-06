import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reading } from "./reading";

const server = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveUnread: vi.fn(),
  saveSort: vi.fn(),
}));

vi.mock("./reading", async (actual) => ({
  ...(await actual<typeof import("./reading")>()),
  ...server,
}));

const { ReadingSettings } = await import("./reading-settings.svelte");

/** A promise and the hands that settle it, for an answer that arrives when the test says. */
function later<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const ON_THE_SERVER: Reading = { sort: "oldest", unread: false };

beforeEach(() => {
  vi.clearAllMocks();
  for (const save of [server.saveUnread, server.saveSort]) save.mockResolvedValue(undefined);
});

describe("the reading settings", () => {
  it("show the server's answer once it arrives", async () => {
    server.loadSettings.mockResolvedValue(ON_THE_SERVER);
    const settings = new ReadingSettings();
    expect(settings.sort).toBeUndefined();
    await settings.load();
    expect([settings.unread, settings.sort]).toEqual([false, "oldest"]);
  });

  it("keep a change the reader made while the first answer was on its way", async () => {
    const answer = later<Reading>();
    server.loadSettings.mockReturnValue(answer.promise);
    const settings = new ReadingSettings();
    const loading = settings.load();
    await settings.changeUnread(true);
    answer.resolve(ON_THE_SERVER);
    await loading;
    expect(settings.unread).toBe(true);
    // The one left alone takes the server's word.
    expect(settings.sort).toBe("oldest");
  });

  it("show the server's answer after all when the change made while it was on its way couldn't be saved", async () => {
    const answer = later<Reading>();
    server.loadSettings.mockReturnValue(answer.promise);
    server.saveUnread.mockRejectedValue(new Error("offline"));
    const settings = new ReadingSettings();
    const loading = settings.load();
    // One fails before the answer arrives, the other after.
    await expect(settings.changeUnread(true)).rejects.toThrow("not saved");
    const saving = later<void>();
    server.saveSort.mockReturnValue(saving.promise);
    const sorting = settings.changeSort("newest");
    answer.resolve(ON_THE_SERVER);
    await loading;
    expect(settings.sort).toBe("newest");
    saving.reject(new Error("offline"));
    await expect(sorting).rejects.toThrow("not saved");
    expect(settings.unread).toBe(false);
    expect(settings.sort).toBe("oldest");
  });

  it("show a change at once, and go back to what the server has when it can't be saved", async () => {
    server.loadSettings.mockResolvedValue(ON_THE_SERVER);
    const settings = new ReadingSettings();
    await settings.load();
    const saving = later<void>();
    server.saveSort.mockReturnValue(saving.promise);
    const changing = settings.changeSort("newest");
    expect(settings.sort).toBe("newest");
    saving.reject(new Error("offline"));
    await expect(changing).rejects.toThrow("not saved");
    expect(settings.sort).toBe("oldest");
  });

  it("save changes in the order made, so the newest wins", async () => {
    server.loadSettings.mockResolvedValue(ON_THE_SERVER);
    const settings = new ReadingSettings();
    await settings.load();
    const first = later<void>();
    server.saveSort.mockReturnValueOnce(first.promise);
    const one = settings.changeSort("newest");
    const two = settings.changeSort("oldest");
    await new Promise((settle) => setTimeout(settle));
    // The second waits for the first.
    expect(server.saveSort.mock.calls).toEqual([["newest"]]);
    first.resolve();
    await Promise.all([one, two]);
    expect(server.saveSort.mock.calls).toEqual([["newest"], ["oldest"]]);
    expect(settings.sort).toBe("oldest");
  });
});
