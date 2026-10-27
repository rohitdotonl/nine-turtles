import { describe, expect, it } from "vitest";
import { newestAnswer, savedInOrder } from "./inorder";

/** A promise the test settles by hand. */
function later<T>() {
  let resolve!: (value: T) => void;
  let reject!: (failure: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("a setting changed twice before the first save answers (survey A8)", () => {
  function setting() {
    const saves: { value: string; done: ReturnType<typeof later<void>> }[] = [];
    let shown = "newest";
    const change = savedInOrder<string>(
      (value) => {
        const done = later<void>();
        saves.push({ value, done });
        return done.promise;
      },
      (value) => (shown = value),
    );
    const set = (value: string) => {
      const before = shown;
      return change(value, before).catch(() => "not saved");
    };
    const save = (index: number) => {
      const each = saves[index];
      if (!each) throw new Error(`no save number ${index} on its way`);
      return each.done;
    };
    return { saves, save, set, shown: () => shown };
  }

  it("sends the saves one at a time, in the order made", async () => {
    const sort = setting();
    void sort.set("oldest");
    void sort.set("random");
    await settle();
    expect(sort.saves.map((save) => save.value)).toEqual(["oldest"]);
    sort.save(0).resolve();
    await settle();
    expect(sort.saves.map((save) => save.value)).toEqual(["oldest", "random"]);
  });

  it("keeps the later change on screen when the earlier one fails", async () => {
    const sort = setting();
    const first = sort.set("oldest");
    void sort.set("random");
    await settle();
    sort.save(0).reject(new Error("refused"));
    expect(await first).toBe("not saved");
    expect(sort.shown()).toBe("random");
  });

  it("goes back to what the server last kept when the latest change fails", async () => {
    const sort = setting();
    void sort.set("oldest");
    const second = sort.set("random");
    await settle();
    sort.save(0).resolve();
    await settle();
    sort.save(1).reject(new Error("refused"));
    expect(await second).toBe("not saved");
    expect(sort.shown()).toBe("oldest");
  });

  it("goes back to the start when every change fails", async () => {
    const sort = setting();
    void sort.set("oldest");
    const second = sort.set("random");
    await settle();
    sort.save(0).reject(new Error("refused"));
    await settle();
    sort.save(1).reject(new Error("refused"));
    await second;
    expect(sort.shown()).toBe("newest");
  });
});

describe("a list loaded again before the first answer arrives (survey A8)", () => {
  it("hands every caller the newest answer, even when the older one arrives last", async () => {
    const answers = [later<string[]>(), later<string[]>()] as const;
    let asked = 0;
    const load = newestAnswer(() => answers[asked++ === 0 ? 0 : 1].promise);
    const before = load();
    const after = load();
    answers[1].resolve(["Daring Fireball"]);
    answers[0].resolve(["Daring Fireball", "Unsubscribed feed"]);
    expect(await before).toEqual(["Daring Fireball"]);
    expect(await after).toEqual(["Daring Fireball"]);
  });

  it("doesn't hand back an older failure when the newest answer worked", async () => {
    const answers = [later<string[]>(), later<string[]>()] as const;
    let asked = 0;
    const load = newestAnswer(() => answers[asked++ === 0 ? 0 : 1].promise);
    const before = load();
    const after = load();
    answers[0].reject(new Error("offline"));
    answers[1].resolve(["Daring Fireball"]);
    expect(await before).toEqual(["Daring Fireball"]);
    expect(await after).toEqual(["Daring Fireball"]);
  });
});
