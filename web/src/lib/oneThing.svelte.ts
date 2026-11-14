// "Read one thing at a time", the owner's trial (decision 0269): on a computer
// too, the list alone, then whatever opens alone in the whole window, as a
// phone already reads. Off until switched on, kept on this device only, and
// offered in Settings to the owner alone. It's a trial, not a decision: three
// panes stay the rule (decision 0134) until the owner decides. What it changes
// on screen is the layout's (`layout.svelte.ts`).

import { deviceText, setDeviceText } from "./device";

const KEY = "nine-turtles.one-thing-at-a-time";

/** Whether the trial is on, on this device. */
export const oneThing = $state({ on: deviceText(KEY) === "on" });

/** Switches the trial on or off, on this device. */
export function setOneThing(on: boolean): void {
  oneThing.on = on;
  setDeviceText(KEY, on ? "on" : null);
}
