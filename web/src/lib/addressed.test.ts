import { describe, expect, it } from "vitest";
import { addressParts } from "./addressed";

const addresses = (text: string) => addressParts(text).flatMap((part) => (part.address ? [part.text] : []));

describe("finding the addresses in a sentence", () => {
  it("finds web and email addresses, without the sentence's own stops", () => {
    expect(addresses("Use https://web20.example.com/feed.xml instead?")).toEqual(["https://web20.example.com/feed.xml"]);
    expect(addresses("A link is on its way to sam0@example.com. Open it within 24 hours.")).toEqual(["sam0@example.com"]);
    expect(addresses("That's an email address. Did you mean their website, example.org?")).toEqual(["example.org"]);
    expect(addresses("turtle-0x+cooking@in.nineturtles.app takes email again.")).toEqual(["turtle-0x+cooking@in.nineturtles.app"]);
    expect(addresses("localhost:3000 is fine, example.com:8080/a is too.")).toEqual(["example.com:8080/a"]);
  });

  it("leaves numbers, dates and ordinary words alone, and keeps every word", () => {
    expect(addresses("You follow 1,000 sources, as many as one reader can.")).toEqual([]);
    expect(addresses("Kept until 10 Dec · 2.5 MB · e.g. this")).toEqual([]);
    const text = "Email to a+b@example.com is now turned away.";
    expect(addressParts(text).map((part) => part.text).join("")).toBe(text);
  });
});
