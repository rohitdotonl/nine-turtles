// Whether the device is set to dark, kept up to date as it switches (an
// evening schedule, say), so "Match device" follows it live: Shell applies
// the preferences again and the theme tiles redraw in the version showing
// (decision 0046). One listener for the whole app, added when this loads.
import { deviceIsDark } from "./preferences";

export const device = $state({ dark: deviceIsDark() });

try {
  globalThis.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", (event) => (device.dark = event.matches));
} catch {
  // No way to ask the device: slowfeed stays on the day version for "Match device".
}
