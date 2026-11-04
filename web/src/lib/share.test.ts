import { describe, expect, it } from "vitest";
import { bookmarklet, firstWebAddress, sharedAddress } from "./share";

describe("a shared link's address", () => {
  it("takes url when it has one", () => {
    expect(sharedAddress("?url=https%3A%2F%2Fexample.com%2Fblog&text=Hello")).toBe("https://example.com/blog");
    expect(sharedAddress("?url=example.com")).toBe("example.com");
  });

  it("finds the address inside text when url is empty, as share menus often send it", () => {
    expect(sharedAddress("?url=&text=" + encodeURIComponent("Read this https://example.com/post?id=3 it's good"))).toBe(
      "https://example.com/post?id=3",
    );
    expect(sharedAddress("?title=A%20blog&text=" + encodeURIComponent("A blog\nhttp://example.org/"))).toBe("http://example.org/");
  });

  it("falls back to title, and is empty with no web address anywhere", () => {
    expect(sharedAddress("?title=" + encodeURIComponent("https://example.net/feed.xml"))).toBe("https://example.net/feed.xml");
    expect(sharedAddress("?text=no%20address%20here&title=Nothing")).toBe("");
    expect(sharedAddress("")).toBe("");
  });

  it("leaves off a sentence's punctuation after the address", () => {
    expect(firstWebAddress("See (https://example.com/a).")).toBe("https://example.com/a");
    expect(firstWebAddress("“https://example.com/b”, she wrote!")).toBe("https://example.com/b");
    expect(firstWebAddress("<https://example.com/c>")).toBe("https://example.com/c");
  });

  it("takes only web addresses, never another kind", () => {
    expect(firstWebAddress("javascript:alert(1) ftp://example.com")).toBe("");
    expect(firstWebAddress("HTTPS://Example.com/x")).toBe("HTTPS://Example.com/x");
  });

  it("cuts an absurdly long address", () => {
    expect(sharedAddress("?url=" + "a".repeat(5000))).toHaveLength(2048);
    expect(firstWebAddress("https://example.com/" + "a".repeat(5000))).toHaveLength(2048);
  });
});

describe("the ways in from elsewhere", () => {
  it("builds the bookmark from this nine turtles' own address", () => {
    expect(bookmarklet("https://app.nineturtles.app")).toBe(
      "javascript:void(location.href='https://app.nineturtles.app/add?url='+encodeURIComponent(location.href))",
    );
  });
});
