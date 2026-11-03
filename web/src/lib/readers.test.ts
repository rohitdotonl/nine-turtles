import { describe, expect, it } from "vitest";
import { HEARD_ABOUT, explainSignUp, plausibleEmail, type SignUpResult } from "./readers";

describe("email addresses", () => {
  it("are checked as the server checks them", () => {
    for (const good of ["rohit@example.com", "a@b", "first.last+feeds@example.co.in"]) {
      expect(plausibleEmail(good), good).toBe(true);
    }
    for (const bad of [
      "",
      "rohit",
      "@example.com",
      "rohit@",
      "ro hit@example.com",
      "a@b@c",
      `${"a".repeat(250)}@example.com`,
      "evil<victim@example.com>",
      '"evil"@example.com',
      "a,victim@example.com",
      "victim@[127.0.0.1]",
    ]) {
      expect(plausibleEmail(bad), bad).toBe(false);
    }
  });
});

describe("the sign-up page's messages", () => {
  it("are calm and never shout", () => {
    const reasons = ["email", "password-short", "password-long", "already", "too-many", "unreachable"] as const;
    for (const reason of reasons) {
      const message = explainSignUp({ ok: false, reason } as Exclude<SignUpResult, { ok: true }>);
      expect(message).not.toContain("!");
      expect(message.endsWith(".")).toBe(true);
    }
    expect(explainSignUp({ ok: false, reason: "password-short" })).toBe("Choose a password of at least 12 characters.");
  });
});

describe("how did you hear about nine turtles?", () => {
  it("offers the answers the server keeps, each said in plain words", () => {
    // The same list as `HEARD_ABOUT` in server/src/people.rs, in its order.
    expect(HEARD_ABOUT.map((answer) => answer.value)).toEqual(["blog", "friend", "search", "ai", "reddit", "other"]);
    for (const answer of HEARD_ABOUT) expect(answer.words).toMatch(/^[A-Z][a-z]* ?[A-Za-z ]*$/);
  });
});
