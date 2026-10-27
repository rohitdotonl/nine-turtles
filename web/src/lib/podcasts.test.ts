import { describe, expect, it } from "vitest";
import { added, clock, episodeFrom, finished, left, length, moved, nextSpeed, removed, resumeFrom, speedLabel, spoken, type Place } from "./podcasts";

describe("the player's times (SPEC section 34)", () => {
  it("shows times as a clock does, in whole seconds", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(5.9)).toBe("0:05");
    expect(clock(754)).toBe("12:34");
    expect(clock(3723)).toBe("1:02:03");
    expect(clock(Number.NaN)).toBe("0:00");
    expect(clock(-3)).toBe("0:00");
  });

  it("shows the time left with a minus sign, never below nothing", () => {
    expect(left(60, 1800)).toBe("−29:00");
    expect(left(1900, 1800)).toBe("−0:00");
  });

  it("says times in words for screen readers", () => {
    expect(spoken(3723)).toBe("1 hour 2 minutes 3 seconds");
    expect(spoken(60)).toBe("1 minute");
    expect(spoken(45)).toBe("45 seconds");
    expect(spoken(0)).toBe("0 seconds");
  });

  it("gives an episode's length shortly, as a list row shows it", () => {
    expect(length(20)).toBe("under a minute");
    expect(length(45 * 60)).toBe("45 min");
    expect(length(60 * 60)).toBe("1 hr");
    expect(length(65 * 60 + 10)).toBe("1 hr 5 min");
  });

  it("cycles through the four speeds", () => {
    expect(nextSpeed(1)).toBe(1.25);
    expect(nextSpeed(1.25)).toBe(1.5);
    expect(nextSpeed(1.5)).toBe(2);
    expect(nextSpeed(2)).toBe(1);
    expect(nextSpeed(3)).toBe(1);
    expect(speedLabel(1.25)).toBe("1.25×");
  });
});

describe("carrying on where the reader stopped", () => {
  const place = (position: number, at: number, extra: Partial<Place> = {}): Place => ({ position, duration: 1800, finished: false, at, ...extra });

  it("starts at the beginning when nothing was saved", () => {
    expect(resumeFrom(undefined, undefined)).toBe(0);
  });

  it("takes the newer of the server's place and this device's own", () => {
    expect(resumeFrom(place(100, 2_000), place(50, 1_000))).toBe(100);
    // Saved on this device while offline, after the server's.
    expect(resumeFrom(place(100, 2_000), place(300, 3_000))).toBe(300);
    expect(resumeFrom(undefined, place(42, 1))).toBe(42);
    expect(resumeFrom(place(42, 1), undefined)).toBe(42);
  });

  it("starts a finished episode again from the beginning", () => {
    expect(resumeFrom(place(1795, 1, { finished: true }), undefined)).toBe(0);
    // Stopped in its last 30 seconds counts as finished.
    expect(resumeFrom(place(1780, 1), undefined)).toBe(0);
    expect(resumeFrom(place(1760, 1), undefined)).toBe(1760);
  });

  it("counts the last 30 seconds as the end", () => {
    expect(finished(1770, 1800)).toBe(true);
    expect(finished(1769, 1800)).toBe(false);
    expect(finished(10, null)).toBe(false);
  });
});

describe("Up Next's order", () => {
  it("adds at the end, once", () => {
    expect(added([1, 2], 3)).toEqual([1, 2, 3]);
    expect(added([1, 2], 1)).toEqual([1, 2]);
  });

  it("removes", () => {
    expect(removed([1, 2, 3], 2)).toEqual([1, 3]);
    expect(removed([1], 9)).toEqual([1]);
  });

  it("moves one place up or down, and stays put at either end", () => {
    expect(moved([1, 2, 3], 2, -1)).toEqual([2, 1, 3]);
    expect(moved([1, 2, 3], 2, 1)).toEqual([1, 3, 2]);
    expect(moved([1, 2, 3], 1, -1)).toEqual([1, 2, 3]);
    expect(moved([1, 2, 3], 3, 1)).toEqual([1, 2, 3]);
    expect(moved([1, 2, 3], 9, 1)).toEqual([1, 2, 3]);
  });
});

describe("an article's episode", () => {
  it("is read from the server's answer, web addresses only", () => {
    expect(
      episodeFrom({
        episode_url: "https://radio.example/1.mp3",
        episode_type: "audio/mpeg",
        episode_bytes: 1000,
        episode_seconds: 1800,
        episode_artwork: "https://radio.example/show.jpg",
      }),
    ).toEqual({ url: "https://radio.example/1.mp3", type: "audio/mpeg", bytes: 1000, seconds: 1800, artwork: "https://radio.example/show.jpg" });
    expect(episodeFrom({ episode_url: "javascript:alert(1)" })).toBeNull();
    expect(episodeFrom({})).toBeNull();
    expect(episodeFrom({ episode_url: "http://radio.example/2.mp3", episode_artwork: "data:image/png;base64,AA" })?.artwork).toBeNull();
  });
});
