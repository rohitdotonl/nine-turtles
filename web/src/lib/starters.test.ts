import { describe, expect, it } from "vitest";
import type { Feed } from "./shapes";
import type { AddResult } from "./feeds";
import { GUIDE_URL, STARTERS, addLabel, addStarters, partlyAdded, siteName, startProblem, type Starter } from "./starters";

const [first, second, third] = STARTERS as readonly [Starter, Starter, Starter, ...Starter[]];
const feed = (id: number, title: string): Feed => ({ id, title }) as Feed;

describe("the New to feeds? starters", () => {
  it("are a short list of publishers' own feeds, each named once and said in one line", () => {
    expect(STARTERS.length).toBeGreaterThanOrEqual(3);
    expect(STARTERS.length).toBeLessThanOrEqual(6);
    expect(new Set(STARTERS.map((starter) => starter.feed)).size).toBe(STARTERS.length);
    expect(new Set(STARTERS.map((starter) => starter.name)).size).toBe(STARTERS.length);
    for (const starter of STARTERS) {
      expect(new URL(starter.feed).protocol).toBe("https:");
      expect(new URL(starter.site).protocol).toBe("https:");
      expect(starter.about.length).toBeLessThanOrEqual(48);
      expect(starter.about).not.toMatch(/[!.]$/);
    }
    expect(GUIDE_URL).toBe("https://nineturtles.app/new-to-feeds/");
  });

  it("are added one after another, the ones that fail kept to say so", async () => {
    const asked: string[] = [];
    const steps: number[] = [];
    const answers: Record<string, AddResult> = {
      [first.feed]: { kind: "added", feed: feed(1, "One") },
      [second.feed]: { kind: "problem", reason: "unreachable" },
      [third.feed]: { kind: "already", feedId: 7 },
    };
    const filed: [number, unknown][] = [];
    const result = await addStarters(
      STARTERS.slice(0, 3),
      (done) => steps.push(done),
      async (address) => {
        asked.push(address);
        return answers[address] ?? { kind: "problem", reason: "trouble" };
      },
      async (id, changes) => {
        filed.push([id, changes]);
        return undefined;
      },
    );
    expect(asked).toEqual(STARTERS.slice(0, 3).map((starter) => starter.feed));
    expect(steps).toEqual([0, 1, 2, 3]);
    expect(result.added.map((added) => added.id)).toEqual([1]);
    // Each one added is filed as a person, someone you might write back to.
    expect(filed).toEqual([[1, { kind: "person" }]]);
    expect(result.added[0]?.kind).toBe("person");
    expect(result.failed).toEqual([second]);
  });

  it("say plainly what couldn't be added", () => {
    expect(startProblem([first])).toBe("James couldn't be added. Try again later, or choose another.");
    expect(startProblem(STARTERS.slice(0, 2))).toBe("Those feeds couldn't be added. Try again later.");
    expect(partlyAdded([first])).toBe("James couldn't be added. Try again later from + Add.");
    expect(partlyAdded(STARTERS.slice(0, 3))).toBe(
      "James, Derek Sivers and Herman Martinus couldn't be added. Try again later from + Add.",
    );
  });

  it("add all five with nothing ticked, or only the ones ticked", () => {
    expect(addLabel(0)).toBe("Add all five");
    expect(addLabel(1)).toBe("Add 1 chosen");
    expect(addLabel(2)).toBe("Add 2 chosen");
  });

  it("show each site's address as the reader would type it", () => {
    expect(siteName("https://www.jefftk.com/")).toBe("jefftk.com");
    expect(siteName("https://herman.bearblog.dev/")).toBe("herman.bearblog.dev");
  });
});
