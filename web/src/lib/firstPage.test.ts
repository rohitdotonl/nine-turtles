// The script written into index.html (decision 0260): the reader's chosen page
// from the first moment, the same one preferences.ts then puts into effect, and
// its fingerprint in the server's rules, without which the browser refuses it.
import { describe, expect, it } from "vitest";
import page from "../../index.html?raw";
import security from "../../../server/src/security.rs?raw";
import { LOOKS, PAGES, showing } from "./themes";

const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((found) => found[1] ?? "");
const script = scripts[0] ?? "";
/** The second: the first screen's answers, asked for while the app's code is on its way (decision 0320). */
const asking = scripts[1] ?? "";

/** Runs the script as the browser would, with this saved page; answers what it set. */
function run(saved: string | null) {
  const dataset: Record<string, string> = {};
  const metas = [{ content: "#FFFFFF" }, { content: "#121212" }];
  let later: (() => void) | undefined;
  const opening = { hidden: true };
  const document = {
    documentElement: { dataset },
    querySelectorAll: () => metas,
    getElementById: (id: string) => (id === "opening" ? opening : null),
  };
  const localStorage = { getItem: () => saved };
  new Function("document", "localStorage", "setTimeout", script)(document, localStorage, (then: () => void) => (later = then));
  return { dataset, metas, opening, later };
}

describe("the page's first moment", () => {
  it("has only scripts the server's rules let run", async () => {
    expect(page.match(/<script>/g)).toHaveLength(2);
    for (const each of [script, asking]) {
      expect(each).not.toBe("");
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(each)));
      const fingerprint = btoa(String.fromCharCode(...digest));
      expect(security).toContain(`'sha256-${fingerprint}'`);
    }
  });

  it("shows White, Paper or Night when the reader chose it, as preferences.ts will", () => {
    for (const { value } of PAGES) {
      const { dataset, metas } = run(JSON.stringify({ page: value }));
      if (value === "auto") {
        // Match device is the stylesheet's own (a dark device gets Night before any script).
        expect(dataset).toEqual({});
        continue;
      }
      const theme = showing(value, false);
      expect(dataset).toEqual({ theme, mode: LOOKS[theme].mode });
      for (const meta of metas) expect(meta.content).toBe(LOOKS[theme].page.toUpperCase());
    }
  });

  it("leaves the page alone when nothing, or nothing it knows, is saved", () => {
    for (const saved of [null, "not json", JSON.stringify({ page: "sepia" }), "null"]) expect(run(saved).dataset).toEqual({});
  });

  it("says it's opening only after a second", () => {
    const { opening, later } = run(null);
    expect(opening.hidden).toBe(true);
    later?.();
    expect(opening.hidden).toBe(false);
    expect(page).toContain('<p id="opening" class="opening" role="status" hidden>Opening your reading…</p>');
  });
});

describe("the page asks for the first screen before the app's code arrives (decision 0320)", () => {
  function ask(kept: string | null, path: string) {
    const asked: string[] = [];
    const window: { nineTurtlesEarly?: Record<string, unknown> } = {};
    const fetch = (address: string) => {
      asked.push(address);
      return Promise.resolve(new Response("{}"));
    };
    new Function("window", "localStorage", "location", "fetch", asking)(window, { getItem: () => kept }, { pathname: path }, fetch);
    return { asked, handed: Object.keys(window.nineTurtlesEarly ?? {}) };
  }

  it("asks who is signed in, their settings and everyone they follow, and hands them to the app", () => {
    const { asked, handed } = ask(null, "/unread");
    expect(asked).toEqual(["/api/session", "/api/settings", "/api/feeds"]);
    expect(handed).toEqual(asked);
  });

  it("asks for the list this address opened last time, as early.ts noted it", () => {
    const { asked } = ask(JSON.stringify({ "/unread": "/api/articles?view=unread&order=newest" }), "/unread");
    expect(asked).toContain("/api/articles?view=unread&order=newest");
    expect(ask(JSON.stringify({ "/unread": "/api/articles?view=unread&order=newest" }), "/saved").asked).toHaveLength(3);
  });

  it("asks only nine turtles' own server, and leaves it all to the app if its note is broken", () => {
    expect(ask(JSON.stringify({ "/unread": "https://elsewhere.example/x" }), "/unread").asked).toHaveLength(3);
    expect(ask("{not json", "/unread").asked).toHaveLength(0);
  });
});
