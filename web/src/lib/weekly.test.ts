import { describe, expect, it } from "vitest";
import { explainOften, minutesAhead, oftenHint } from "./weekly";

describe("the weekly email's words", () => {
  it("say when it comes, on or off, and never a count", () => {
    expect(oftenHint("weekly")).toMatch(/^Saturday mornings/);
    expect(oftenHint("off")).toMatch(/^Once a week: the people you read/);
    for (const often of ["off", "weekly"] as const) expect(oftenHint(often)).not.toMatch(/\d/);
  });

  it("say why a choice wasn't saved", () => {
    expect(explainOften("no-email")).toMatch(/send email/);
    expect(explainOften("no-address")).toMatch(/email address/);
    expect(explainOften("unconfirmed")).toMatch(/confirmed address/);
    expect(explainOften("trouble")).toMatch(/Try again in a moment/);
  });

  it("send the reader's clock as minutes ahead of UTC", () => {
    const india = { getTimezoneOffset: () => -330 } as Date;
    expect(minutesAhead(india)).toBe(330);
  });
});
