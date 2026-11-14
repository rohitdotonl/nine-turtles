import { afterEach, describe, expect, it, vi } from "vitest";
import { LIST_MIN, panesFor, ScreenLayout, widthFor } from "./layout.svelte";
import { setOneThing } from "./oneThing.svelte";

describe("layout", () => {
  it("steps from three panes to two to one as the window narrows", () => {
    expect(widthFor(80)).toBe("wide");
    expect(widthFor(60)).toBe("medium");
    expect(widthFor(30)).toBe("narrow");
  });

  it("shows all three areas on a wide window", () => {
    expect(panesFor("wide", "auto")).toEqual({ sidebar: true, list: true, article: true });
    expect(panesFor("wide", "hidden")).toEqual({ sidebar: false, list: true, article: true });
  });

  it("shows two areas on a medium window: list and article, or sidebar and list", () => {
    expect(panesFor("medium", "auto")).toEqual({ sidebar: false, list: true, article: true });
    expect(panesFor("medium", "shown")).toEqual({ sidebar: true, list: true, article: false });
  });

  it("hides the list on a computer, leaving the article its room", () => {
    expect(panesFor("wide", "auto", false, true)).toEqual({ sidebar: true, list: false, article: true });
    expect(panesFor("wide", "hidden", false, true)).toEqual({ sidebar: false, list: false, article: true });
    expect(panesFor("medium", "shown", false, true)).toEqual({ sidebar: true, list: false, article: true });
    expect(panesFor("narrow", "hidden", false, true)).toEqual({ sidebar: false, list: true, article: false });
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
    expect(new ScreenLayout("narrow", 400, () => false, true).panes).toEqual({ sidebar: true, list: false, article: false });
    expect(new ScreenLayout("narrow", 400, () => false, false).panes).toEqual({ sidebar: false, list: true, article: false });
    // Only a phone starts with the sidebar put away.
    expect(new ScreenLayout("wide", 1400, () => false, false).panes.sidebar).toBe(true);
  });

  it("shows an opened article in the list's place on a phone", () => {
    let reading = false;
    const layout = new ScreenLayout("narrow", 400, () => reading, false);
    reading = true;
    expect(layout.panes).toEqual({ sidebar: false, list: false, article: true });
    layout.showHome(true);
    expect(layout.panes).toEqual({ sidebar: true, list: false, article: false });
  });

  it("knows whether the reader has moved since the screen opened", () => {
    const layout = new ScreenLayout("narrow", 400, () => false, true);
    expect(layout.moved).toBe(false);
    layout.showHome(true);
    expect(layout.moved).toBe(true);
  });

  it("toggles the sidebar, or the sidebar and list together, saying whether they hid", () => {
    const layout = new ScreenLayout("wide", 1400, () => false, true);
    expect(layout.toggleSidebar()).toBe(true);
    expect(layout.panes.sidebar).toBe(false);
    expect(layout.toggleSidebar()).toBe(false);
    // f: either one showing hides both; pressed again, both come back. The list never hides alone (decision 0241).
    expect(layout.toggleBoth()).toBe(true);
    expect(layout.panes).toEqual({ sidebar: false, list: false, article: true });
    expect(layout.toggleBoth()).toBe(false);
    expect(layout.panes).toEqual({ sidebar: true, list: true, article: true });
  });

  it("makes way for an article on a medium window only", () => {
    const medium = new ScreenLayout("medium", 1000, () => false, true);
    medium.toggleSidebar();
    expect(medium.panes).toEqual({ sidebar: true, list: true, article: false });
    medium.makeWayForArticle();
    expect(medium.panes).toEqual({ sidebar: false, list: true, article: true });
    const wide = new ScreenLayout("wide", 1400, () => false, true);
    wide.makeWayForArticle();
    expect(wide.panes.sidebar).toBe(true);
  });

  it("goes back to what suits the width when the window crosses a breakpoint", () => {
    const layout = new ScreenLayout("wide", 1400, () => false, true);
    layout.toggleSidebar();
    layout.resized("medium");
    expect(layout.sidebarChoice).toBe("auto");
    expect(layout.phone).toBe(false);
    layout.resized("narrow");
    expect(layout.phone).toBe(true);
  });

  it("carries what the reader hid across a version switch, except on a phone", () => {
    const before = new ScreenLayout("wide", 1400, () => false, true);
    before.toggleBoth();
    const after = new ScreenLayout("wide", 1400, () => false, true);
    after.putBack(before.carried());
    expect(after.panes).toEqual({ sidebar: false, list: false, article: true });
    // A list hidden on its own, from before decision 0241, comes back: nothing could show it again.
    const alone = new ScreenLayout("wide", 1400, () => false, true);
    alone.putBack({ sidebar: "shown", listHidden: true });
    expect(alone.panes).toEqual({ sidebar: true, list: true, article: true });
    const phone = new ScreenLayout("narrow", 400, () => false, true);
    phone.putBack(before.carried());
    expect(phone.panes.sidebar).toBe(true);
  });

  it("keeps dragged widths on this device, and the list within its limits", () => {
    const kept = storage({ "nine-turtles.sidebar-width": "300", "nine-turtles.list-width": "200" });
    vi.stubGlobal("localStorage", kept);
    const layout = new ScreenLayout("wide", 1400, () => false, true);
    expect(layout.sidebarPx).toBe(300);
    expect(layout.listPx).toBe(LIST_MIN);
    // 1400 less the sidebar's 300 less 400 for the article is 700, more than the most the list can have.
    expect(layout.listMax).toBe(640);
    layout.windowWidth = 900;
    expect(layout.listMax).toBe(LIST_MIN);
    layout.listWidth = 360;
    layout.storeListWidth();
    expect(kept.getItem("nine-turtles.list-width")).toBe("360");
    layout.sidebarWidth = undefined;
    layout.storeSidebarWidth();
    expect(kept.getItem("nine-turtles.sidebar-width")).toBeNull();
    expect(layout.sidebarPx).toBe(256);
  });

  it("gives the usual widths when nothing is kept", () => {
    vi.stubGlobal("localStorage", storage({ "nine-turtles.list-width": "nonsense" }));
    const layout = new ScreenLayout("wide", 1400, () => false, true);
    expect(layout.sidebarPx).toBe(256);
    expect(layout.listPx).toBeUndefined();
  });
});

// Decision 0269: the owner's trial, "Read one thing at a time".
describe("reading one thing at a time", () => {
  afterEach(() => {
    setOneThing(false);
    vi.unstubAllGlobals();
  });

  it("on a computer, shows the list alone and then the article alone", () => {
    expect(panesFor("wide", "auto", false, false, true)).toEqual({ sidebar: true, list: true, article: false });
    expect(panesFor("wide", "auto", true, false, true)).toEqual({ sidebar: false, list: false, article: true });
    // A medium window keeps the sidebar beside the list too, unless the reader hid it.
    expect(panesFor("medium", "auto", false, false, true)).toEqual({ sidebar: true, list: true, article: false });
    expect(panesFor("medium", "hidden", false, false, true)).toEqual({ sidebar: false, list: true, article: false });
    // A phone already reads this way: nothing changes there.
    expect(panesFor("narrow", "hidden", true, false, true)).toEqual(panesFor("narrow", "hidden", true));
  });

  it("is the owner's alone, and only when switched on, on this device", () => {
    vi.stubGlobal("localStorage", storage());
    let reading = false;
    const trial = (owner: boolean) => new ScreenLayout("wide", 1400, () => reading, false, { aside: () => false, owner: () => owner });
    expect(trial(true).panes).toEqual({ sidebar: true, list: true, article: true });
    setOneThing(true);
    expect(localStorage.getItem("nine-turtles.one-thing-at-a-time")).toBe("on");
    const owner = trial(true);
    expect(owner.trial).toBe(true);
    expect(owner.stepwise).toBe(true);
    expect(owner.panes).toEqual({ sidebar: true, list: true, article: false });
    reading = true;
    expect(owner.panes).toEqual({ sidebar: false, list: false, article: true });
    expect(trial(false).trial).toBe(false);
    expect(trial(false).panes).toEqual({ sidebar: true, list: true, article: true });
    setOneThing(false);
    expect(localStorage.getItem("nine-turtles.one-thing-at-a-time")).toBeNull();
    expect(owner.trial).toBe(false);
  });

  it("fills the window with a person's page too, and leaves a phone as it is", () => {
    setOneThing(true);
    const page = new ScreenLayout("wide", 1400, () => false, false, { aside: () => true, owner: () => true });
    expect(page.panes).toEqual({ sidebar: false, list: false, article: true });
    const phone = new ScreenLayout("narrow", 400, () => false, false, { aside: () => false, owner: () => true });
    expect(phone.trial).toBe(false);
    expect(phone.stepwise).toBe(true);
  });
});
