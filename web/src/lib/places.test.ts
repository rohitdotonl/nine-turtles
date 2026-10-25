import { describe, expect, it } from "vitest";
import { KEPT, keepPlace, placeOf } from "./places";

function memory(): Storage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  } as Storage;
}

describe("your place in an article", () => {
  it("has none until you stop part of the way through", () => {
    expect(placeOf(7, memory())).toBeUndefined();
  });

  it("remembers the block and how far into it, per article", () => {
    const storage = memory();
    keepPlace(7, { block: 12, within: 0.25 }, storage);
    keepPlace(8, { block: 3, within: 0 }, storage);
    expect(placeOf(7, storage)).toEqual({ block: 12, within: 0.25 });
    expect(placeOf(8, storage)).toEqual({ block: 3, within: 0 });
  });

  it("forgets it at the top or the end", () => {
    const storage = memory();
    keepPlace(7, { block: 12, within: 0.25 }, storage);
    keepPlace(7, undefined, storage);
    expect(placeOf(7, storage)).toBeUndefined();
  });

  it("keeps only the most recent articles' places", () => {
    const storage = memory();
    for (let id = 1; id <= KEPT + 5; id++) keepPlace(id, { block: 1, within: 0 }, storage, id);
    expect(placeOf(5, storage)).toBeUndefined();
    expect(placeOf(6, storage)).toEqual({ block: 1, within: 0 });
    expect(placeOf(KEPT + 5, storage)).toEqual({ block: 1, within: 0 });
  });

  it("ignores anything it doesn't understand, and works without storage", () => {
    const storage = memory();
    storage.setItem("nine-turtles.places", '{"7":{"block":-1,"within":2},"8":"x"}');
    expect(placeOf(7, storage)).toBeUndefined();
    expect(placeOf(8, storage)).toBeUndefined();
    storage.setItem("nine-turtles.places", "not json");
    expect(placeOf(7, storage)).toBeUndefined();
    expect(placeOf(7, undefined)).toBeUndefined();
    expect(() => keepPlace(7, { block: 1, within: 0 }, undefined)).not.toThrow();
  });
});
