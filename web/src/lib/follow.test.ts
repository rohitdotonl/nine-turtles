import { afterEach, describe, expect, it, vi } from "vitest";
import { followTitle, readLooked, sayProblem, siteOf } from "./follow";
import { PROBLEMS, type Problem } from "./feeds";

describe("looking at a shared page", () => {
  /** A fetch that answers with `body` and `status`, and remembers what it was asked and how. */
  function server(body: unknown, status = 200) {
    const asked: { path: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string, init?: RequestInit) => {
        asked.push({ path, method: init?.method ?? "GET" });
        return new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    return asked;
  }
  async function load() {
    vi.resetModules();
    return import("./follow");
  }
  afterEach(() => vi.unstubAllGlobals());

  it("only looks (a GET to the finder), never follows", async () => {
    const asked = server({
      feeds: [{ title: "A blog", url: "https://example.com/feed" }],
      preview: null,
    });
    const { lookAt } = await load();
    expect(await lookAt("https://example.com/a b")).toEqual({
      kind: "found",
      choices: [{ title: "A blog", url: "https://example.com/feed" }],
      name: "A blog",
      site: "",
    });
    expect(asked).toEqual([
      {
        path: "/api/find-feeds?address=https%3A%2F%2Fexample.com%2Fa%20b",
        method: "GET",
      },
    ]);
  });

  it("keeps quiet when the finder is busy, so Follow still works the ordinary way", async () => {
    server({ error: "site-busy" }, 429);
    expect(await (await load()).lookAt("example.com")).toEqual({
      kind: "quiet",
    });
  });
});

describe("who a shared page is by", () => {
  it("names them by the feed's own title, with their site", () => {
    const looked = readLooked({
      feeds: [{ title: "Comments", url: "https://jane.example/feed" }],
      preview: {
        title: "  Jane\n Doe ",
        site: "https://jane.example/",
      },
    });
    expect(looked).toMatchObject({
      kind: "found",
      name: "Jane Doe",
      site: "https://jane.example/",
    });
  });

  it("says a page with no way to follow it is a problem, and an unknown answer is quiet", () => {
    expect(readLooked({ feeds: [] })).toEqual({
      kind: "problem",
      reason: "no-feed",
    });
    expect(readLooked({ error: "no-feed" })).toEqual({
      kind: "problem",
      reason: "no-feed",
    });
    expect(readLooked(null)).toEqual({ kind: "quiet" });
  });

  it("asks the question with their name, or about 'this person' until it's known", () => {
    expect(followTitle("Jane Doe")).toBe("Follow Jane Doe?");
    expect(followTitle("")).toBe("Follow this person?");
  });

  it("says the site as a person would", () => {
    expect(siteOf("https://www.jane.example/posts/1")).toBe("jane.example");
    expect(siteOf("jane.example")).toBe("jane.example");
  });

  it("never says 'feed' or 'RSS' in its problems", () => {
    for (const reason of [...PROBLEMS, "offline", "trouble"] as Problem[]) {
      expect(sayProblem(reason)).not.toMatch(/feed|rss/i);
    }
  });
});
