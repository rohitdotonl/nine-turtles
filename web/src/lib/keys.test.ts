import { beforeEach, describe, expect, it, vi } from "vitest";

// Each save waits until the test answers it, so two changes can overlap.
const answers: { keys: Record<string, string>; settle: (ok: boolean) => void }[] = [];
vi.mock("./reading", () => ({
  lastKeys: () => ({}),
  forgetKeys: vi.fn(),
  saveKeys: (keys: Record<string, string>) =>
    new Promise<void>((resolve, reject) => answers.push({ keys, settle: (ok) => (ok ? resolve() : reject(new Error("not saved"))) })),
}));

const { chooseKeys, forgetChosenKeys, keys } = await import("./keys.svelte");

/** Lets the saves queued so far start. */
const started = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("saving the reader's keys (decision 0110)", () => {
  beforeEach(() => {
    answers.length = 0;
    forgetChosenKeys();
  });

  it("keeps the newest keys when an older save fails, since the newer one carries it", async () => {
    const first = chooseKeys({ star: "x" });
    await started();
    const second = chooseKeys({ star: "x", "mark-unread": "y" });
    answers[0]!.settle(false);
    await expect(first).resolves.toBeUndefined();
    await started();
    answers[1]!.settle(true);
    await expect(second).resolves.toBeUndefined();
    expect(keys.chosen).toEqual({ star: "x", "mark-unread": "y" });
  });

  it("goes back to the last keys the server has when the newest save fails", async () => {
    const first = chooseKeys({ star: "x" });
    await started();
    const second = chooseKeys({ star: "x", "mark-unread": "y" });
    answers[0]!.settle(true);
    await first;
    await started();
    answers[1]!.settle(false);
    await expect(second).rejects.toThrow("not saved");
    expect(keys.chosen).toEqual({ star: "x" });
  });

  it("sends the saves one after another, so the server ends with the newest", async () => {
    void chooseKeys({ star: "x" });
    void chooseKeys({ star: "z" });
    await started();
    expect(answers).toHaveLength(1);
    answers[0]!.settle(true);
    await started();
    expect(answers.map((each) => each.keys)).toEqual([{ star: "x" }, { star: "z" }]);
    answers[1]!.settle(true);
  });

  it("forgets the keys at sign-out", () => {
    keys.chosen = { star: "x" };
    forgetChosenKeys();
    expect(keys.chosen).toEqual({});
  });
});
