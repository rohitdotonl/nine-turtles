import { describe, expect, it } from "vitest";
import { keptLine, readKept } from "./recentlyUnsubscribed";

const at = (day: string) => new Date(`${day}T12:00:00`).getTime() / 1000;

describe("Recently unsubscribed", () => {
  it("reads each kept place, a person's places left together as one row, and leaves out what's malformed", () => {
    const list = [
      {
        feed_id: 4,
        title: "Hal Brennan",
        person: 2,
        unsubscribed_at: 100,
        kept_until: 200,
        by_assistant: false,
      },
      {
        feed_id: 5,
        title: "Hal Brennan",
        person: 2,
        unsubscribed_at: 100,
        kept_until: 200,
        by_assistant: false,
      },
      {
        feed_id: 6,
        title: "Quiet Notes",
        person: null,
        unsubscribed_at: 90,
        kept_until: 190,
        by_assistant: true,
      },
      { feed_id: "x", title: "broken" },
    ];
    expect(readKept(list)).toEqual([
      {
        ids: [4, 5],
        title: "Hal Brennan",
        unsubscribedAt: 100,
        keptUntil: 200,
        byAssistant: false,
      },
      {
        ids: [6],
        title: "Quiet Notes",
        unsubscribedAt: 90,
        keptUntil: 190,
        byAssistant: true,
      },
    ]);
    expect(readKept(undefined)).toEqual([]);
  });

  it("says when, until when, and whether an assistant did it", () => {
    const now = new Date("2026-11-08T15:00:00");
    const own = {
      ids: [1],
      title: "Hal",
      unsubscribedAt: at("2026-11-08"),
      keptUntil: at("2026-12-08"),
      byAssistant: false,
    };
    expect(keptLine(own, now)).toBe(
      "Unsubscribed today · kept until 8\u00a0Dec",
    );
    expect(
      keptLine(
        {
          ...own,
          unsubscribedAt: at("2026-11-04"),
          keptUntil: at("2026-12-04"),
          byAssistant: true,
        },
        now,
      ),
    ).toBe("Unsubscribed by an assistant 4\u00a0Nov · kept until 4\u00a0Dec");
  });
});
