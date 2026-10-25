import { describe, expect, it } from "vitest";
import { explainChange, explainForgot, explainLink, ticketFrom, type ChangeResult, type LinkResult } from "./accounts";
import { explain } from "./session";

describe("emailed links", () => {
  it("give their ticket to the page they open", () => {
    expect(ticketFrom("#ticket=ab12")).toBe("ab12");
    expect(ticketFrom("ticket=ab12")).toBe("ab12");
    expect(ticketFrom("#other=1")).toBe("");
    expect(ticketFrom("")).toBe("");
  });
});

describe("the messages about email", () => {
  it("never say whether an address has an account", () => {
    expect(explainForgot("asked", " mira@example.com ")).toBe(
      "If mira@example.com has an account here, a link to choose a new password is on its way. It works for an hour.",
    );
  });

  it("say calmly when nine turtles can't send email", () => {
    expect(explainForgot("no-email", "")).toContain("can't send email yet");
    expect(explainChange({ ok: false, reason: "no-email" })).toContain("can't send email yet");
  });

  it("are calm and never shout", () => {
    const messages = [
      ...(["asked", "email", "no-email", "unreachable"] as const).map((result) => explainForgot(result, "a@b")),
      ...(["expired", "already", "too-many", "password-short", "password-long", "unreachable"] as const).flatMap(
        (result: Exclude<LinkResult, "ok">) => [explainLink(result, "reset"), explainLink(result, "confirm")],
      ),
      ...(
        [
          { ok: true, sentTo: "a@b" },
          { ok: false, reason: "email" },
          { ok: false, reason: "same" },
          { ok: false, reason: "wrong-password" },
          { ok: false, reason: "too-many" },
          { ok: false, reason: "wait", waitSeconds: 120 },
          { ok: false, reason: "unreachable" },
        ] as ChangeResult[]
      ).map(explainChange),
      explain({ ok: false, reason: "unconfirmed", sent: true }),
      explain({ ok: false, reason: "unconfirmed", sent: false }),
    ];
    for (const message of messages) {
      expect(message).not.toContain("!");
      expect(message.endsWith(".")).toBe(true);
    }
    expect(explainChange({ ok: false, reason: "wait", waitSeconds: 120 })).toBe("Too many wrong tries. Try again in 2 minutes.");
  });

  it("send the reader back the right way when a link has run out", () => {
    expect(explainLink("expired", "reset")).toContain("sign-in page");
    expect(explainLink("expired", "confirm")).toContain("sign up again");
  });
});
