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
  it("starts with DESIGN.md's defaults: Original, matching the device, Literata, medium size and width", () => {
    expect(load(memory())).toEqual(DEFAULTS);
    expect(DEFAULTS).toEqual({ theme: "original", appearance: "auto", readingFont: "literata", textSize: 2, lineWidth: "medium" });
  });

  it("keeps a theme chosen before decision 0046 as its nearest new theme and Appearance", () => {
    const expected: Record<string, [string, string]> = {
      system: ["original", "auto"],
      "off-white": ["original", "light"],
      sepia: ["original", "light"],
      porcelain: ["original", "light"],
      linen: ["original", "light"],
      mist: ["original", "light"],
      sage: ["original", "light"],
      dark: ["original", "dark"],
      graphite: ["original", "dark"],
      night: ["original", "dark"],
      midnight: ["original", "dark"],
      black: ["original", "dark"],
      quiet: ["original", "auto"],
      paper: ["original", "auto"],
      bold: ["original", "auto"],
      calm: ["original", "auto"],
      focus: ["original", "auto"],
    };
    for (const [old, [theme, appearance]] of Object.entries(expected)) {
      const storage = memory();
      storage.setItem("slowfeed.preferences", JSON.stringify({ theme: old, readingFont: "atkinson", textSize: 4, lineWidth: "wide" }));
      expect(load(storage), old).toEqual({ theme, appearance, readingFont: "atkinson", textSize: 4, lineWidth: "wide" });
    }
    // A removed theme saved with an Appearance keeps that Appearance (decision 0056).
    const calm = memory();
    calm.setItem("slowfeed.preferences", JSON.stringify({ theme: "calm", appearance: "dark" }));
    expect(load(calm)).toEqual({ ...DEFAULTS, appearance: "dark" });
    // Saved before the rename (as slowfeed): still read; once saved under the new name, that wins.
    const renamed = memory();
    renamed.setItem("slowfeed.preferences", JSON.stringify({ textSize: 4 }));
    expect(load(renamed).textSize).toBe(4);
    renamed.setItem("nine-turtles.preferences", JSON.stringify({ textSize: 1 }));
    expect(load(renamed).textSize).toBe(1);
    // A name that only looks like one of the old themes keeps the defaults.
    const storage = memory();
    storage.setItem("nine-turtles.preferences", JSON.stringify({ theme: "constructor" }));
    expect(load(storage)).toEqual(DEFAULTS);
  });

  it("remembers what was chosen on this device", () => {
    const storage = memory();
    const chosen: Preferences = { theme: "original", appearance: "dark", readingFont: "atkinson", textSize: 4, lineWidth: "wide" };
    save(chosen, storage);
    expect(load(storage)).toEqual(chosen);
    // Plain and the device's own serif, rohit.onl's look and font (decision 0062).
    const plain: Preferences = { theme: "plain", appearance: "light", readingFont: "system-serif", textSize: 2, lineWidth: "medium" };
    save(plain, storage);
    expect(load(storage)).toEqual(plain);
  });

  it("ignores anything it doesn't understand, keeping the defaults", () => {
    const storage = memory();
    storage.setItem("nine-turtles.preferences", JSON.stringify({ theme: "blue", appearance: "dusk", textSize: 99, lineWidth: "huge" }));
    expect(load(storage)).toEqual(DEFAULTS);
    storage.setItem("nine-turtles.preferences", JSON.stringify({ lineWidth: "constructor", readingFont: "toString" }));
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
    apply({ theme: "original", appearance: "dark", readingFont: "atkinson", textSize: 0, lineWidth: "narrow" }, page, false);
    expect(root.dataset.theme).toBe("original");
    expect(root.dataset.mode).toBe("dark");
    expect(set.get("--reading-font")).toContain("Atkinson Hyperlegible");
    expect(set.get("--reading-size")).toBe("1rem");
    expect(set.get("--reading-measure")).toBe("52ch");

    // Match device follows the device's setting.
    apply(DEFAULTS, page, true);
    expect([root.dataset.theme, root.dataset.mode]).toEqual(["original", "dark"]);
    apply(DEFAULTS, page, false);
    expect(root.dataset.mode).toBe("light");
  });

});
