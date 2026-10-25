import { describe, expect, it } from "vitest";
import { explainSignUp, inviteFrom, inviteLink, plausibleEmail, type SignUpResult } from "./readers";

describe("invite links", () => {
  it("are this site's sign-up page with the ticket", () => {
    expect(inviteLink("https://app.nineturtles.app", "ab12")).toBe("https://app.nineturtles.app/sign-up?invite=ab12");
    expect(inviteLink("http://127.0.0.1:8080/", "ab12")).toBe("http://127.0.0.1:8080/sign-up?invite=ab12");
  });

  it("give their ticket back to the sign-up page", () => {
    expect(inviteFrom("?invite=ab12")).toBe("ab12");
    expect(inviteFrom("?other=1")).toBe("");
    expect(inviteFrom("")).toBe("");
  });
});

describe("email addresses", () => {
  it("are checked as the server checks them", () => {
    for (const good of ["rohit@example.com", "a@b", "first.last+feeds@example.co.in"]) {
      expect(plausibleEmail(good), good).toBe(true);
    }
    for (const bad of ["", "rohit", "@example.com", "rohit@", "ro hit@example.com", "a@b@c", `${"a".repeat(250)}@example.com`]) {
      expect(plausibleEmail(bad), bad).toBe(false);
    }
  });
});

describe("the sign-up page's messages", () => {
  it("are calm and never shout", () => {
    const reasons = ["closed", "email", "password-short", "password-long", "already", "too-many", "unreachable"] as const;
    for (const reason of reasons) {
      const message = explainSignUp({ ok: false, reason } as Exclude<SignUpResult, { ok: true }>);
      expect(message).not.toContain("!");
      expect(message.endsWith(".")).toBe(true);
    }
    expect(explainSignUp({ ok: false, reason: "password-short" })).toBe("Choose a password of at least 12 characters.");
  });
});
