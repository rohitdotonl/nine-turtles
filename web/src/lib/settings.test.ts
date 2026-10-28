import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reading } from "./reading";

const server = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveMode: vi.fn(),
  saveSort: vi.fn(),
  saveCounts: vi.fn(),
  saveLetGo: vi.fn(),
  saveHidden: vi.fn(),
  saveKeys: vi.fn(),
}));

vi.mock("./reading", async (actual) => ({
  ...(await actual<typeof import("./reading")>()),
  ...server,
}));

const { ReadingSettings } = await import("./settings.svelte");
const { keys, chooseKeys } = await import("./keys.svelte");

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

const ON_THE_SERVER: Reading = { sort: "oldest", mode: "river", counts: "hidden", letGo: "month", keys: { star: "x" }, hidden: ["recent"] };

beforeEach(() => {
  vi.clearAllMocks();
  for (const save of [server.saveMode, server.saveSort, server.saveCounts, server.saveLetGo, server.saveHidden, server.saveKeys]) save.mockResolvedValue(undefined);
  keys.chosen = {};
});

describe("the reading settings", () => {
  it("show the server's answer once it arrives", async () => {
    server.loadSettings.mockResolvedValue(ON_THE_SERVER);
    const settings = new ReadingSettings();
    expect(settings.sort).toBeUndefined();
    await settings.load();
    expect([settings.mode, settings.sort, settings.counts, settings.letGo, settings.hidden]).toEqual(["river", "oldest", "hidden", "month", ["recent"]]);
    expect(keys.chosen).toEqual({ star: "x" });
  });

  it("keep a change the reader made while the first answer was on its way", async () => {
    const answer = later<Reading>();
    server.loadSettings.mockReturnValue(answer.promise);
    const settings = new ReadingSettings();
    const loading = settings.load();
    await settings.changeMode("inbox");
    await settings.changeHidden(["starred"]);
    await chooseKeys({ star: "z" });
    answer.resolve(ON_THE_SERVER);
    await loading;
    expect(settings.mode).toBe("inbox");
    expect(settings.hidden).toEqual(["starred"]);
    expect(keys.chosen).toEqual({ star: "z" });
    // The ones left alone take the server's word.
    expect([settings.sort, settings.counts, settings.letGo]).toEqual(["oldest", "hidden", "month"]);
  });

  it("show a change at once, and go back to what the server has when it can't be saved", async () => {
    server.loadSettings.mockResolvedValue(ON_THE_SERVER);
    const settings = new ReadingSettings();
    await settings.load();
    const saving = later<void>();
    server.saveCounts.mockReturnValue(saving.promise);
    const changing = settings.changeCounts("shown");
    expect(settings.counts).toBe("shown");
    saving.reject(new Error("offline"));
    await expect(changing).rejects.toThrow("not saved");
    expect(settings.counts).toBe("hidden");
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
