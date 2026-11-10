import { describe, expect, it } from "vitest";
import { datedParts } from "./dated";

const dates = (text: string) => datedParts(text).flatMap((part) => (part.date ? [part.text] : []));

describe("finding the dates in a sentence", () => {
  it("finds dates and times as the app writes them, in either order", () => {
    expect(dates("Unsubscribed today · kept until 10 Dec")).toEqual(["10 Dec"]);
    expect(dates("kept until 10\u00a0Dec")).toEqual(["10\u00a0Dec"]);
    expect(dates("This feed hasn't worked since Oct 30, 2025.")).toEqual(["Oct 30, 2025"]);
    expect(dates("Nothing new has arrived since 10:05.")).toEqual(["10:05"]);
    expect(dates("Nothing new has arrived since 2:05 PM.")).toEqual(["2:05 PM"]);
    expect(dates("Connected 3 Nov 2025 · Last used 10 Nov")).toEqual(["3 Nov 2025", "10 Nov"]);
  });

  it("leaves addresses, titles and codes alone, and keeps every word", () => {
    expect(dates("web20.example.com is on its own now.")).toEqual([]);
    expect(dates("“Release 1.0.0”, 4 Nov · Work")).toEqual(["4 Nov"]);
    const text = "Quiet since 14 Mar: “On CVE-2026-0010”";
    expect(datedParts(text).map((part) => part.text).join("")).toBe(text);
  });
});
