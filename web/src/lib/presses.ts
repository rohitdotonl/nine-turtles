// Work the reader never waits for (fetching copies for reading offline) gives
// way while they're using nine turtles (decision 0320): on a slow phone
// connection a tap's answer would otherwise queue behind it. Each press (a
// tap, a click, a key) stops what that work is downloading, and the work
// carries on once the reader has paused for a moment.

/** How long after the last press the work carries on. */
export const QUIET_MS = 1_500;
/** How often a waiting piece of work looks again. */
const LOOK_EVERY_MS = 250;

let lastPress = 0;
const stops = new Set<() => void>();

/** The reader pressed something: what's downloading stops, and work waits a moment. */
export function pressed(now = Date.now()): void {
  lastPress = now;
  for (const stop of [...stops]) stop();
}

/** Resolves once the reader hasn't pressed anything for `QUIET_MS`. */
export async function quiet(): Promise<void> {
  while (Date.now() - lastPress < QUIET_MS) await new Promise((resolve) => setTimeout(resolve, LOOK_EVERY_MS));
}

/** A signal that stops a download at the reader's next press; `done` once it's over. */
export function untilPressed(): { signal: AbortSignal; done: () => void } {
  const control = new AbortController();
  const stop = () => control.abort();
  stops.add(stop);
  return { signal: control.signal, done: () => stops.delete(stop) };
}

if (typeof globalThis.addEventListener === "function") {
  for (const name of ["pointerdown", "keydown"]) globalThis.addEventListener(name, () => pressed(), { capture: true, passive: true });
}
