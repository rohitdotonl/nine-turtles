import { describe, expect, it } from "vitest";
import type { AddResult, Feed } from "./feeds";
import { GUIDE_URL, STARTERS, addStarters, partlyAdded, startProblem, type Starter } from "./starters";

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
    const result = await addStarters(
      STARTERS.slice(0, 3),
      (done) => steps.push(done),
      async (address) => {
        asked.push(address);
        return answers[address] ?? { kind: "problem", reason: "trouble" };
      },
    );
    expect(asked).toEqual(STARTERS.slice(0, 3).map((starter) => starter.feed));
    expect(steps).toEqual([0, 1, 2, 3]);
    expect(result.added.map((added) => added.id)).toEqual([1]);
    expect(result.failed).toEqual([second]);
  });

  it("say plainly what couldn't be added", () => {
    expect(startProblem([first])).toBe("The Marginalian didn't answer. Try again later, or choose another.");
    expect(startProblem(STARTERS.slice(0, 2))).toBe("Those sites didn't answer. Try again later.");
    expect(partlyAdded([first])).toBe("Couldn't add The Marginalian. Try again later from Add feed.");
    expect(partlyAdded(STARTERS.slice(0, 3))).toBe(
      "Couldn't add The Marginalian, The Public Domain Review and kottke.org. Try again later from Add feed.",
    );
  });
});
