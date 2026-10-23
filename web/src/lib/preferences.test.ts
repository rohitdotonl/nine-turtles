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
  it("starts with DESIGN.md's defaults: follow the device, Literata, medium size and width", () => {
    expect(load(memory())).toEqual(DEFAULTS);
    expect(DEFAULTS).toEqual({ theme: "system", readingFont: "literata", textSize: 2, lineWidth: "medium" });
  });

  it("remembers what was chosen on this device", () => {
    const storage = memory();
    const chosen: Preferences = { theme: "sepia", readingFont: "atkinson", textSize: 4, lineWidth: "wide" };
    save(chosen, storage);
    expect(load(storage)).toEqual(chosen);
  });

  it("ignores anything it doesn't understand, keeping the defaults", () => {
    const storage = memory();
    storage.setItem("slowfeed.preferences", JSON.stringify({ theme: "blue", textSize: 99, lineWidth: "huge" }));
    expect(load(storage)).toEqual(DEFAULTS);
    storage.setItem("slowfeed.preferences", "not json");
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
    apply({ theme: "dark", readingFont: "atkinson", textSize: 0, lineWidth: "narrow" }, root as unknown as HTMLElement);
    expect(root.dataset.theme).toBe("dark");
    expect(set.get("--reading-font")).toContain("Atkinson Hyperlegible");
    expect(set.get("--reading-size")).toBe("1rem");
    expect(set.get("--reading-measure")).toBe("62ch");

    // Following the device removes the chosen theme.
    apply(DEFAULTS, root as unknown as HTMLElement);
    expect(root.dataset.theme).toBeUndefined();
  });
});
