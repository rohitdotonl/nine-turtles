import { afterEach, describe, expect, it, vi } from "vitest";
import { pressed, quiet, QUIET_MS, untilPressed } from "./presses";

afterEach(() => vi.useRealTimers());

describe("work the reader never waits for gives way to their taps (decision 0320)", () => {
  it("stops a download at the next press", () => {
    const press = untilPressed();
    expect(press.signal.aborted).toBe(false);
    pressed();
    expect(press.signal.aborted).toBe(true);
  });

  it("leaves a finished download's signal alone", () => {
    const press = untilPressed();
    press.done();
    pressed();
    expect(press.signal.aborted).toBe(false);
  });

  it("carries on only once the reader has paused", async () => {
    vi.useFakeTimers();
    pressed();
    let carried = false;
    void quiet().then(() => (carried = true));
    await vi.advanceTimersByTimeAsync(QUIET_MS / 2);
    expect(carried).toBe(false);
    await vi.advanceTimersByTimeAsync(QUIET_MS);
    expect(carried).toBe(true);
  });
});
