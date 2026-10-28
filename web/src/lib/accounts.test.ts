import { describe, expect, it } from "vitest";
import { explainAsked, explainChange, explainLink, ticketFrom, type ChangeResult, type LinkResult } from "./accounts";

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
    // "Forgot?" sends a sign-in link, which works for 15 minutes (decision 0122).
    expect(explainAsked("asked", " mira@example.com ")).toBe(
      "If mira@example.com has an account here, a link is on its way. It works once, within 15 minutes.",
    );
  });

  it("say calmly when nine turtles can't send email", () => {
    expect(explainAsked("no-email", "")).toBe(
      "This nine turtles can't send email yet. Ask whoever runs it to set a new password for you.",
    );
    expect(explainChange({ ok: false, reason: "no-email" })).toContain("can't send email yet");
  });

  it("are calm and never shout", () => {
    const messages = [
      ...(["asked", "email", "no-email", "unreachable"] as const).map((result) => explainAsked(result, "a@b")),
      ...(["expired", "already", "too-many", "password-short", "password-long", "unreachable"] as const).flatMap(
        (result: Exclude<LinkResult, "ok">) => [
          explainLink(result, "reset"),
          explainLink(result, "confirm"),
          explainLink(result, "sign-in"),
        ],
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
    ];
    for (const message of messages) {
      expect(message).not.toContain("!");
      expect(message.endsWith(".")).toBe(true);
    }
    expect(explainChange({ ok: false, reason: "wait", waitSeconds: 120 })).toBe("Too many wrong tries. Try again in 2 minutes.");
  });

  it("send the reader back the right way when a link has run out", () => {
    expect(explainLink("expired", "reset")).toContain("sign-in page");
    expect(explainLink("expired", "confirm")).toContain("Change your email again");
  });
});
