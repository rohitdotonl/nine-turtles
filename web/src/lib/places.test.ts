import { describe, expect, it } from "vitest";
import { KEPT, keepPlace, onPlaces, placeOf, howFarWords } from "./places";

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

  it("keeps how much was read, and keeps it when the same place comes back from the server", () => {
    const storage = memory();
    keepPlace(7, { block: 12, within: 0.25, read: 0.6 }, storage);
    expect(placeOf(7, storage)).toEqual({ block: 12, within: 0.25, read: 0.6 });
    keepPlace(7, { block: 12, within: 0.25 }, storage);
    expect(placeOf(7, storage)).toEqual({ block: 12, within: 0.25, read: 0.6 });
    // Another device's place elsewhere in the article: this device no longer knows how far.
    keepPlace(7, { block: 20, within: 0 }, storage);
    expect(placeOf(7, storage)).toEqual({ block: 20, within: 0 });
  });

  it("tells the list whenever a place is kept or forgotten", () => {
    const storage = memory();
    let told = 0;
    const stop = onPlaces(() => told++);
    keepPlace(7, { block: 1, within: 0 }, storage);
    keepPlace(7, undefined, storage);
    stop();
    keepPlace(7, { block: 1, within: 0 }, storage);
    expect(told).toBe(2);
  });
});

describe("how far, in words (decision 0220)", () => {
  it("says it plainly, never as a number", () => {
    expect(howFarWords({ block: 1, within: 0, read: 0.1 })).toBe("Just begun");
    expect(howFarWords({ block: 1, within: 0, read: 0.33 })).toBe("A third read");
    expect(howFarWords({ block: 1, within: 0, read: 0.5 })).toBe("Half read");
    expect(howFarWords({ block: 1, within: 0, read: 0.66 })).toBe("Two-thirds read");
    expect(howFarWords({ block: 1, within: 0, read: 0.9 })).toBe("Nearly finished");
  });

  it("says only Part read for a place from another device", () => {
    expect(howFarWords({ block: 4, within: 0.5 })).toBe("Part read");
  });
});
