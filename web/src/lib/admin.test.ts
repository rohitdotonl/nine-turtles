import { describe, expect, it } from "vitest";
import { backupDay, count, date, lastHereDay, plural, size, toOverview } from "./admin";

describe("the owner's Readers page", () => {
  it("reads the server's answer, and anything missing as nothing", () => {
    const overview = toOverview({
      totals: { readers: 2, feeds: 40, feeds_resting: 3, feeds_failing: 1, articles: 900 },
      database_bytes: 12_000_000,
      backups: { on: true, latest_nightly: "nightly/2026-10-25.sqlite" },
      email_sending: false,
      problems: [{ at: 5, message: "something" }],
      readers: [
        { id: 1, email: null, owner: true, created_at: 10, feeds: 30, feeds_failing: 1, last_here: 20 },
        { id: 2, email: "a@example.com", owner: false, created_at: 11, feeds: 10, feeds_failing: 0 },
      ],
      most_feeds: 1000,
      away_after_days: 30,
    });
    expect(overview.totals.feedsResting).toBe(3);
    expect(overview.readers[0]).toEqual({
      id: 1,
      email: null,
      owner: true,
      createdAt: 10,
      feeds: 30,
      feedsFailing: 1,
      lastHere: 20,
      plan: null,
    });
    // Without a last visit, the day they joined.
    expect(overview.readers[1]?.lastHere).toBe(11);
    expect(overview.latestBackup).toBe("nightly/2026-10-25.sqlite");
    expect(overview.problems).toEqual([{ at: 5, message: "something" }]);

    const empty = toOverview(null);
    expect(empty.readers).toEqual([]);
    expect(empty.totals.readers).toBe(0);
    expect(empty.backupsOn).toBe(false);
    expect(empty.mostFeeds).toBe(1000);
    expect(empty.awayAfterDays).toBe(30);
  });

  it("says today, or the day, for a reader's last visit", () => {
    const now = new Date(2026, 9, 26, 15, 0);
    const seconds = (at: Date) => at.getTime() / 1000;
    expect(lastHereDay(seconds(new Date(2026, 9, 26, 0, 5)), now)).toBe("today");
    const yesterday = seconds(new Date(2026, 9, 25, 23, 55));
    expect(lastHereDay(yesterday, now)).toBe(date(yesterday));
    expect(date(yesterday)).toBe("25 October 2026");
  });

  it("writes counts and sizes as people read them", () => {
    expect(count(1340)).toBe("1,340");
    expect(plural(1, "feed", "feeds")).toBe("1 feed");
    expect(plural(1000, "feed", "feeds")).toBe("1,000 feeds");
    expect(size(840_000)).toBe("840 KB");
    expect(size(312_400_000)).toBe("312 MB");
    expect(size(1_240_000_000)).toBe("1.2 GB");
    expect(size(0)).toBe("1 KB");
  });

  it("reads the day of the newest backup from its name", () => {
    expect(backupDay("nightly/2026-10-25.sqlite")).toBe("25 October 2026");
    expect(backupDay(null)).toBeNull();
    expect(backupDay("something else")).toBeNull();
  });
});
