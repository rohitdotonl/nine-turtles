import { describe, expect, it, vi } from "vitest";
import { addressFix, emailFix, slipPause } from "./typos";

describe("a mistyped email provider (decision 0234)", () => {
  it("is fixed when one slip from a well-known provider", () => {
    expect(emailFix("asha.rao@gmial.com")).toBe("asha.rao@gmail.com"); // swapped
    expect(emailFix("asha@gmai.com")).toBe("asha@gmail.com"); // missing
    expect(emailFix("asha@gmaill.com")).toBe("asha@gmail.com"); // doubled
    expect(emailFix("asha@hotmaul.com")).toBe("asha@hotmail.com"); // the key beside
    expect(emailFix("asha@gmail.con")).toBe("asha@gmail.com");
    expect(emailFix("asha@gmail.cm")).toBe("asha@gmail.com");
    expect(emailFix("asha@outlook.co")).toBe("asha@outlook.com");
    expect(emailFix("asha@yahoo.comm")).toBe("asha@yahoo.com");
    expect(emailFix("asha@icloudcom")).toBe("asha@icloud.com"); // missing dot
    expect(emailFix("asha@gmail,com")).toBe("asha@gmail.com"); // wrong dot
    expect(emailFix("asha@gmail .com")).toBe("asha@gmail.com"); // a space
    expect(emailFix("asha@gmail.com.")).toBe("asha@gmail.com"); // trailing dot
    expect(emailFix("asha@proton.ne")).toBe("asha@proton.me");
    expect(emailFix(" Asha.Rao@GMIAL.com ")).toBe("Asha.Rao@gmail.com"); // the part before @ kept as typed
  });

  it("leaves right, real and unknown providers alone", () => {
    for (const email of [
      "asha@gmail.com",
      "asha@Gmail.com",
      "asha@ymail.com",
      "asha@mail.com",
      "asha@email.com",
      "asha@hotmail.co.uk",
      "asha@protonmail.com",
      "asha@me.com",
      "asha@cloud.com",
      "asha@gardenletters.blog",
      "asha@gmeil.com", // e isn't beside a: no single obvious slip
      "asha",
      "@gmial.com",
      "a@b@gmial.com",
    ]) {
      expect(emailFix(email), email).toBeUndefined();
    }
  });
});

describe("a mistyped web address (decision 0234)", () => {
  it("offers the one obvious repair", () => {
    expect(addressFix("gardenletters,blog")).toEqual({ address: "gardenletters.blog", dot: true });
    expect(addressFix("gardenletters;blog")).toEqual({ address: "gardenletters.blog", dot: true });
    expect(addressFix("gardenletters blog")).toEqual({ address: "gardenletters.blog", dot: true });
    expect(addressFix("www,gardenletters.blog")).toEqual({ address: "www.gardenletters.blog", dot: true });
    expect(addressFix("htps://gardenletters.blog")).toEqual({ address: "https://gardenletters.blog" });
    expect(addressFix("https;//gardenletters.blog")).toEqual({ address: "https://gardenletters.blog" });
    expect(addressFix("http//gardenletters.blog")).toEqual({ address: "http://gardenletters.blog" });
    expect(addressFix("https:/gardenletters.blog/feed")).toEqual({ address: "https://gardenletters.blog/feed" });
    expect(addressFix("gardenletters..blog")).toEqual({ address: "gardenletters.blog" });
    expect(addressFix("gardenletters.blog.")).toEqual({ address: "gardenletters.blog" });
    expect(addressFix('"gardenletters.blog"')).toEqual({ address: "gardenletters.blog" });
    expect(addressFix("<https://gardenletters.blog/>")).toEqual({ address: "https://gardenletters.blog/" });
    expect(addressFix("(gardenletters.blog)")).toEqual({ address: "gardenletters.blog" });
    expect(addressFix("“gardenletters.blog”.")).toEqual({ address: "gardenletters.blog" });
    expect(addressFix('"gardenletters.blog')).toEqual({ address: "gardenletters.blog" });
    expect(addressFix("HTPS://Example.com")).toEqual({ address: "https://Example.com" });
    expect(addressFix("example.con")).toEqual({ address: "example.com" });
    expect(addressFix("example.cmo/feed")).toEqual({ address: "example.com/feed" });
    expect(addressFix("example.ocm")).toEqual({ address: "example.com" });
    expect(addressFix("example.comm")).toEqual({ address: "example.com" });
    expect(addressFix("example.ogr")).toEqual({ address: "example.org" });
    expect(addressFix("maya@gardenletters.blog")).toEqual({ address: "gardenletters.blog", email: true });
    expect(addressFix("mailto:maya@gardenletters.blog")).toEqual({ address: "gardenletters.blog", email: true });
  });

  it("leaves good addresses, and slips with no one repair, alone", () => {
    for (const address of [
      "gardenletters.blog",
      "gardenletters.blog/",
      "https://gardenletters.blog",
      "http://gardenletters.blog/feed.xml",
      "example.co",
      "example.cm",
      "localhost:8080",
      "example.com:8080/feed",
      "youtube.com/@TwoCentsPBS",
      "example.com/a,b;c",
      "https://user@example.com",
      "maya@gmail.com",
      "maya@yahoo.com",
      "maya@mastodon.social",
      "https://en.wikipedia.org/wiki/Foo_(bar)",
      "example.com/a?x=[1]",
      "example.com/?x='a'",
      "HTTPS://example.com",
      "Https://Example.com/feed",
      "Example.COM",
      "garden letters.blog",
      "garden letters blog",
      "gardenletters",
      "feed://example.com",
      "",
    ]) {
      expect(addressFix(address), address).toBeUndefined();
    }
  });
});

describe("the press that offers an email's fix (decision 0234)", () => {
  it("pauses once, unless the fix has been on screen a moment already", () => {
    vi.useFakeTimers();
    const pause = slipPause();
    expect(pause.pauses("a@gmial.com")).toBe(true);
    expect(pause.pauses("a@gmial.com")).toBe(false);
    // Shown on leaving the field, then pressed straight away (the press itself left the field): it pauses.
    const quick = slipPause();
    quick.shown("b@gmial.com");
    expect(quick.pauses("b@gmial.com")).toBe(true);
    // Shown, and the reader went on to the password: the press sends.
    const seen = slipPause();
    seen.shown("c@gmial.com");
    vi.advanceTimersByTime(1500);
    expect(seen.pauses("c@gmial.com")).toBe(false);
    vi.useRealTimers();
  });
});
