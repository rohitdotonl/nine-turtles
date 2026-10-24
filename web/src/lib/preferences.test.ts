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
      "off-white": ["paper", "light"],
      sepia: ["calm", "light"],
      porcelain: ["original", "light"],
      linen: ["paper", "light"],
      mist: ["quiet", "light"],
      sage: ["focus", "light"],
      dark: ["calm", "dark"],
      graphite: ["quiet", "dark"],
      night: ["calm", "dark"],
      midnight: ["original", "dark"],
      black: ["bold", "dark"],
    };
    for (const [old, [theme, appearance]] of Object.entries(expected)) {
      const storage = memory();
      storage.setItem("slowfeed.preferences", JSON.stringify({ theme: old, readingFont: "atkinson", textSize: 4, lineWidth: "wide" }));
      expect(load(storage), old).toEqual({ theme, appearance, readingFont: "atkinson", textSize: 4, lineWidth: "wide" });
    }
    // A name that only looks like one of the old themes keeps the defaults.
    const storage = memory();
    storage.setItem("slowfeed.preferences", JSON.stringify({ theme: "constructor" }));
    expect(load(storage)).toEqual(DEFAULTS);
  });

  it("remembers what was chosen on this device", () => {
    const storage = memory();
    const chosen: Preferences = { theme: "calm", appearance: "dark", readingFont: "atkinson", textSize: 4, lineWidth: "wide" };
    save(chosen, storage);
    expect(load(storage)).toEqual(chosen);
  });

  it("ignores anything it doesn't understand, keeping the defaults", () => {
    const storage = memory();
    storage.setItem("slowfeed.preferences", JSON.stringify({ theme: "blue", appearance: "dusk", textSize: 99, lineWidth: "huge" }));
    expect(load(storage)).toEqual(DEFAULTS);
    storage.setItem("slowfeed.preferences", JSON.stringify({ lineWidth: "constructor", readingFont: "toString" }));
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
    const page = root as unknown as HTMLElement;
    apply({ theme: "calm", appearance: "dark", readingFont: "atkinson", textSize: 0, lineWidth: "narrow" }, page, false);
    expect(root.dataset.theme).toBe("calm");
    expect(root.dataset.mode).toBe("dark");
    expect(set.get("--reading-font")).toContain("Atkinson Hyperlegible");
    expect(set.get("--reading-weight")).toBe("400");
    expect(set.get("--reading-size")).toBe("1rem");
    expect(set.get("--reading-measure")).toBe("52ch");

    // Match device follows the device's setting.
    apply(DEFAULTS, page, true);
    expect([root.dataset.theme, root.dataset.mode]).toEqual(["original", "dark"]);
    apply(DEFAULTS, page, false);
    expect(root.dataset.mode).toBe("light");
  });

  it("sets the article text heavier in the Bold theme only: Literata's 600, Atkinson's 700", () => {
    const set = new Map<string, string>();
    const root = { dataset: {} as DOMStringMap, style: { setProperty: (name: string, value: string) => set.set(name, value) } };
    const page = root as unknown as HTMLElement;
    apply({ ...DEFAULTS, theme: "bold" }, page, false);
    expect(set.get("--reading-weight")).toBe("600");
    apply({ ...DEFAULTS, theme: "bold", readingFont: "atkinson" }, page, false);
    expect(set.get("--reading-weight")).toBe("700");
    apply({ ...DEFAULTS, theme: "paper", readingFont: "atkinson" }, page, false);
    expect(set.get("--reading-weight")).toBe("400");
  });
});
