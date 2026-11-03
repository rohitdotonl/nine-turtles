import { describe, expect, it } from "vitest";
import { explainOften, minutesAhead, oftenHint } from "./weekly";

describe("the weekly email's words", () => {
  it("say when it comes for each choice, and never a count", () => {
    expect(oftenHint("weekly")).toMatch(/^Saturday mornings/);
    expect(oftenHint("twice")).toMatch(/^Wednesday and Saturday mornings/);
    expect(oftenHint("off")).toMatch(/Off until you turn it on/);
    for (const often of ["off", "weekly", "twice"] as const) expect(oftenHint(often)).not.toMatch(/\d/);
  });

  it("say why a choice wasn't saved", () => {
    expect(explainOften("no-email")).toMatch(/send email/);
    expect(explainOften("no-address")).toMatch(/email address/);
    expect(explainOften("trouble")).toMatch(/try again/);
  });

  it("send the reader's clock as minutes ahead of UTC", () => {
    const india = { getTimezoneOffset: () => -330 } as Date;
    expect(minutesAhead(india)).toBe(330);
  });
});
