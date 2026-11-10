import { describe, expect, it } from "vitest";
import { DEFAULTS, TEXT_SIZES, apply, load, save, type Preferences } from "./preferences";

function memory(): Storage {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  } as Storage;
}

describe("reader preferences", () => {
  it("starts with DESIGN.md's defaults: Match device, Literata, medium size", () => {
    expect(load(memory())).toEqual(DEFAULTS);
    expect(DEFAULTS).toEqual({ page: "auto", readingFont: "literata", textSize: 2 });
  });

  it("opens a choice from before the pages (decision 0176) as Match device, keeping the rest", () => {
    const storage = memory();
    storage.setItem("nine-turtles.preferences", JSON.stringify({ theme: "fountain-pen", appearance: "dark", lineWidth: "wide" }));
    // A line width saved before there was only one (decision 0187) is let go.
    expect(load(storage)).toEqual(DEFAULTS);
    // A name that only looks like a page keeps the defaults.
    storage.setItem("nine-turtles.preferences", JSON.stringify({ page: "constructor" }));
    expect(load(storage)).toEqual(DEFAULTS);
  });

  it("remembers what was chosen on this device", () => {
    const storage = memory();
    const chosen: Preferences = { page: "paper", readingFont: "atkinson", textSize: 4 };
    save(chosen, storage);
    expect(load(storage)).toEqual(chosen);
    const night: Preferences = { page: "night", readingFont: "system-serif", textSize: 2 };
    save(night, storage);
    expect(load(storage)).toEqual(night);
  });

  it("ignores anything it doesn't understand, keeping the defaults", () => {
    const storage = memory();
    storage.setItem("nine-turtles.preferences", JSON.stringify({ page: "blue", textSize: 99 }));
    expect(load(storage)).toEqual(DEFAULTS);
    storage.setItem("nine-turtles.preferences", JSON.stringify({ readingFont: "toString" }));
    expect(load(storage)).toEqual(DEFAULTS);
    storage.setItem("nine-turtles.preferences", "not json");
    expect(load(storage)).toEqual(DEFAULTS);
  });

  it("still works when the browser's storage is switched off", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => save(DEFAULTS, broken)).not.toThrow();
    expect(load(undefined)).toEqual(DEFAULTS);
  });

  it("offers text sizes from smaller to largest, all at least the normal size", () => {
    expect(TEXT_SIZES.map((size) => size.rem)).toEqual([...TEXT_SIZES.map((size) => size.rem)].sort((a, b) => a - b));
    expect(Math.min(...TEXT_SIZES.map((size) => size.rem))).toBeGreaterThanOrEqual(1);
  });

  it("puts the choices into effect on the page", () => {
    const set = new Map<string, string>();
    const root = { dataset: {} as DOMStringMap, style: { setProperty: (name: string, value: string) => set.set(name, value) } };
    const page = root as unknown as HTMLElement;
    apply({ page: "night", readingFont: "atkinson", textSize: 0 }, page, false);
    expect(root.dataset.theme).toBe("night");
    expect(root.dataset.mode).toBe("dark");
    expect(set.get("--reading-font")).toContain("Atkinson Hyperlegible Next");
    expect(set.get("--reading-size")).toBe("1rem");
    // The smallest text gets the most room between its lines; Atkinson's title is Atkinson.
    expect(set.get("--reading-leading")).toBe("1.6");
    expect(set.get("--reading-title-font")).toBe(set.get("--reading-font"));
    apply({ ...DEFAULTS, textSize: 5 }, page, false);
    expect(set.get("--reading-leading")).toBe("1.45");
    // Literata's title is its display cut (decision 0246).
    expect(set.get("--reading-title-font")).toBe("var(--font-display)");

    // Paper is a day page, whatever the device.
    apply({ ...DEFAULTS, page: "paper" }, page, true);
    expect([root.dataset.theme, root.dataset.mode]).toEqual(["paper", "light"]);

    // Match device: White by day, Night by night, as the device is set.
    apply(DEFAULTS, page, true);
    expect([root.dataset.theme, root.dataset.mode]).toEqual(["night", "dark"]);
    apply(DEFAULTS, page, false);
    expect([root.dataset.theme, root.dataset.mode]).toEqual(["white", "light"]);
  });

});
