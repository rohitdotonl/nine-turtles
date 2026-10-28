import { afterEach, describe, expect, it, vi } from "vitest";
import { deviceJson, deviceText, setDeviceText } from "./device";

function storage(): Storage {
  const kept = new Map<string, string>();
  return {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
    clear: () => kept.clear(),
    key: () => null,
    get length() {
      return kept.size;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settings kept on this device", () => {
  it("keeps, reads and forgets a value", () => {
    vi.stubGlobal("localStorage", storage());
    expect(deviceText("nine-turtles.mode")).toBeNull();
    setDeviceText("nine-turtles.mode", "river");
    expect(deviceText("nine-turtles.mode")).toBe("river");
    setDeviceText("nine-turtles.mode", null);
    expect(deviceText("nine-turtles.mode")).toBeNull();
  });

  it("reads JSON, and nothing from text that isn't JSON", () => {
    vi.stubGlobal("localStorage", storage());
    setDeviceText("nine-turtles.hidden", '["starred"]');
    expect(deviceJson("nine-turtles.hidden")).toEqual(["starred"]);
    setDeviceText("nine-turtles.hidden", "[broken");
    expect(deviceJson("nine-turtles.hidden")).toBeUndefined();
    expect(deviceJson("nine-turtles.nothing")).toBeUndefined();
  });

  it("carries on quietly when the browser refuses (private windows)", () => {
    const refusing = storage();
    refusing.getItem = () => {
      throw new DOMException("refused", "SecurityError");
    };
    refusing.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    vi.stubGlobal("localStorage", refusing);
    expect(deviceText("nine-turtles.mode")).toBeNull();
    expect(() => setDeviceText("nine-turtles.mode", "river")).not.toThrow();
  });
});
