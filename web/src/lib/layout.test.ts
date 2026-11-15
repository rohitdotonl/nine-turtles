import { afterEach, describe, expect, it, vi } from "vitest";
import { panesFor, ScreenLayout, widthFor } from "./layout.svelte";

describe("layout", () => {
  it("steps from a computer's window to a phone's as the window narrows", () => {
    expect(widthFor(80)).toBe("wide");
    expect(widthFor(60)).toBe("medium");
    expect(widthFor(30)).toBe("narrow");
  });

  // Decision 0275: one thing at a time, on a computer as on a phone.
  it("on a computer, shows the list alone beside the sidebar, then the article alone", () => {
    for (const width of ["wide", "medium"] as const) {
      expect(panesFor(width, "auto")).toEqual({ sidebar: true, list: true, article: false });
      expect(panesFor(width, "hidden")).toEqual({ sidebar: false, list: true, article: false });
      expect(panesFor(width, "auto", true)).toEqual({ sidebar: false, list: false, article: true });
    }
  });

  it("shows one area at a time on a phone-narrow window, starting with the sidebar", () => {
    expect(panesFor("narrow", "auto")).toEqual({ sidebar: true, list: false, article: false });
    expect(panesFor("narrow", "hidden")).toEqual({ sidebar: false, list: true, article: false });
    expect(panesFor("narrow", "hidden", true)).toEqual({ sidebar: false, list: false, article: true });
  });
});

/** A device's storage that keeps what it's given, as the browser's would. */
function storage(kept: Record<string, string> = {}): Storage {
  const items = new Map(Object.entries(kept));
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

describe("the screen's layout", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens a phone on the feeds, unless the address names a place", () => {
    expect(new ScreenLayout("narrow", () => false, true).panes).toEqual({ sidebar: true, list: false, article: false });
    expect(new ScreenLayout("narrow", () => false, false).panes).toEqual({ sidebar: false, list: true, article: false });
    // Only a phone starts with the sidebar put away.
    expect(new ScreenLayout("wide", () => false, false).panes.sidebar).toBe(true);
  });

  it("shows an opened article in the list's place on a phone", () => {
    let reading = false;
    const layout = new ScreenLayout("narrow", () => reading, false);
    reading = true;
    expect(layout.panes).toEqual({ sidebar: false, list: false, article: true });
    layout.showHome(true);
    expect(layout.panes).toEqual({ sidebar: true, list: false, article: false });
  });

  it("knows whether the reader has moved since the screen opened", () => {
    const layout = new ScreenLayout("narrow", () => false, true);
    expect(layout.moved).toBe(false);
    layout.showHome(true);
    expect(layout.moved).toBe(true);
  });

  it("toggles the sidebar, saying whether it hid", () => {
    const layout = new ScreenLayout("wide", () => false, true);
    expect(layout.toggleSidebar()).toBe(true);
    expect(layout.panes.sidebar).toBe(false);
    expect(layout.toggleSidebar()).toBe(false);
    expect(layout.panes).toEqual({ sidebar: true, list: true, article: false });
  });

  it("fills a computer's window with a person's page too, and leaves a phone's list in place", () => {
    expect(new ScreenLayout("wide", () => false, false, () => true).panes).toEqual({ sidebar: false, list: false, article: true });
    expect(new ScreenLayout("narrow", () => false, false, () => true).panes).toEqual({ sidebar: false, list: true, article: false });
  });

  it("goes back to what suits the width when the window crosses a breakpoint", () => {
    const layout = new ScreenLayout("wide", () => false, true);
    layout.toggleSidebar();
    layout.resized("medium");
    expect(layout.sidebarChoice).toBe("auto");
    expect(layout.phone).toBe(false);
    layout.resized("narrow");
    expect(layout.phone).toBe(true);
  });

  it("carries a hidden sidebar across a version switch, except on a phone", () => {
    const before = new ScreenLayout("wide", () => false, true);
    before.toggleSidebar();
    const after = new ScreenLayout("wide", () => false, true);
    after.putBack(before.carried());
    expect(after.panes).toEqual({ sidebar: false, list: true, article: false });
    const phone = new ScreenLayout("narrow", () => false, true);
    phone.putBack(before.carried());
    expect(phone.panes.sidebar).toBe(true);
  });

  it("keeps the sidebar's dragged width on this device", () => {
    const kept = storage({ "nine-turtles.sidebar-width": "300" });
    vi.stubGlobal("localStorage", kept);
    const layout = new ScreenLayout("wide", () => false, true);
    expect(layout.sidebarPx).toBe(300);
    layout.sidebarWidth = undefined;
    layout.storeSidebarWidth();
    expect(kept.getItem("nine-turtles.sidebar-width")).toBeNull();
    expect(layout.sidebarPx).toBe(256);
  });

  it("gives the usual width when nothing is kept", () => {
    vi.stubGlobal("localStorage", storage({ "nine-turtles.sidebar-width": "nonsense" }));
    expect(new ScreenLayout("wide", () => false, true).sidebarPx).toBe(256);
  });
});
