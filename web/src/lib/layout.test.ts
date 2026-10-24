import { describe, expect, it } from "vitest";
import { panesFor, widthFor } from "./layout";

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
