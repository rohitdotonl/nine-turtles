import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionSheets } from "./collecting.svelte";
import type { Article } from "./shapes";

const ARTICLE = { id: 7 } as Article;
const RECIPES = { id: 1, name: "Recipes" };
const TO_CITE = { id: 2, name: "to cite" };

class FakeElement {
  focused = false;
  isConnected = true;
  focus() {
    this.focused = true;
  }
}

afterEach(() => vi.unstubAllGlobals());

function stub() {
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("document", { body: new FakeElement() });
}

describe("collection sheets", () => {
  it("open one at a time, and close both, giving the keyboard back to what opened them", async () => {
    stub();
    const sheets = new CollectionSheets();
    const button = new FakeElement();
    sheets.collect(ARTICLE, button as unknown as Element);
    expect(sheets.collecting).toBe(ARTICLE);
    sheets.closed();
    expect(sheets.collecting).toBeUndefined();
    await Promise.resolve();
    expect(button.focused).toBe(true);

    const menu = new FakeElement();
    sheets.rename(RECIPES, menu as unknown as Element);
    expect(sheets.renaming).toBe(RECIPES);
    sheets.closed();
    expect(sheets.renaming).toBeUndefined();
    await Promise.resolve();
    expect(menu.focused).toBe(true);
  });

  it("say nothing when Add to collection closed without taking the article off any", () => {
    stub();
    const sheets = new CollectionSheets();
    sheets.collect(ARTICLE, null);
    expect(sheets.closedCollecting(undefined, [RECIPES])).toBeUndefined();
    sheets.collect(ARTICLE, null);
    expect(sheets.closedCollecting({ article: 7, before: [1], after: [1, 2] }, [RECIPES, TO_CITE])).toBeUndefined();
    expect(sheets.collecting).toBeUndefined();
  });

  it("answer a line with Undo when Save took the article off a collection, and Undo puts it back", async () => {
    stub();
    const asked: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      asked.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const body = url.endsWith("/collections") && !init?.body ? { collections: [2] } : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    });
    const sheets = new CollectionSheets();
    sheets.collect(ARTICLE, null);
    const line = sheets.closedCollecting({ article: 7, before: [1, 2], after: [2] }, [RECIPES, TO_CITE]);
    expect(sheets.collecting).toBeUndefined();
    expect(line?.message).toBe("Took the article off Recipes");
    expect(await line?.undo()).toBeUndefined();
    expect(asked.at(-1)?.body).toEqual({ collections: [2, 1] });
  });
});
