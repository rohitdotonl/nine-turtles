import { describe, expect, it } from "vitest";
import { duration, explain } from "./session";

describe("the sign-in page's messages", () => {
  it("rounds waits up to whole minutes", () => {
    expect(duration(1)).toBe("1 second");
    expect(duration(45)).toBe("45 seconds");
    expect(duration(60)).toBe("1 minute");
    expect(duration(61)).toBe("2 minutes");
    expect(duration(3600)).toBe("60 minutes");
  });

  it("are calm and never shout", () => {
    const messages = [
      explain({ ok: false, reason: "wrong-password" }),
      explain({ ok: false, reason: "wait", waitSeconds: 120 }),
      explain({ ok: false, reason: "password-missing" }),
      explain({ ok: false, reason: "password-invalid" }),
      explain({ ok: false, reason: "unreachable" }),
    ];
    expect(messages[1]).toBe("Too many wrong tries. Try again in 2 minutes.");
    for (const message of messages) expect(message).not.toContain("!");
  });

  it("never say whether an email has an account", () => {
    expect(explain({ ok: false, reason: "wrong-password" })).toBe("That isn't the password.");
    expect(explain({ ok: false, reason: "wrong-password" }, true)).toBe("That email and password don't match.");
  });
});
