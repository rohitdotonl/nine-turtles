// Installing nine turtles (SPEC section 20, decision 0151): which device and
// browser this is, and the steps that put nine turtles on its home screen or
// Dock. Read from the browser's own description of itself; a guess that's
// wrong only changes which steps come first, since every device's are shown.

export type Device = "iphone" | "ipad" | "android" | "mac-safari" | "chrome" | "edge" | "firefox" | "other";

/** What the browser says about itself: its user agent and how many fingers its screen takes. */
export type Browser = { userAgent: string; maxTouchPoints: number };

export function deviceOf({ userAgent: ua, maxTouchPoints }: Browser): Device {
  if (/iPhone|iPod/.test(ua)) return "iphone";
  // An iPad asks for the desktop site, so it says "Macintosh"; only its touch screen gives it away.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return "ipad";
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\/|Chromium\//.test(ua)) return "chrome";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua)) return "mac-safari";
  return "other";
}

/** One device's steps: where they're for, and each press in order (or none, where it can't install). */
export type Guide = { where: string; steps: string[]; foot?: string };

const PHONE = [
  "Tap Share: the square with an arrow pointing up. In the newest Safari, it's under More (…).",
  "Scroll down if you need to, and tap Add to Home Screen.",
  "Tap Add.",
];

export const GUIDES: Record<Device, Guide> = {
  iphone: { where: "iPhone", steps: PHONE, foot: "nine turtles is on your home screen: open it from there." },
  ipad: { where: "iPad", steps: PHONE, foot: "nine turtles is on your home screen: open it from there." },
  android: {
    where: "Android phone",
    steps: ["Tap the browser's menu: the three dots at the top right.", "Tap Add to home screen, or Install app.", "Tap Install."],
    foot: "nine turtles is on your home screen: open it from there.",
  },
  "mac-safari": {
    where: "Mac, in Safari",
    steps: ["In the menu bar, choose File, then Add to Dock.", "Click Add."],
    foot: "nine turtles is in your Dock and opens in its own window. This needs macOS Sonoma or later.",
  },
  chrome: {
    where: "computer, in Chrome",
    steps: [
      "Click the install icon at the right end of the address bar: a screen with an arrow pointing down.",
      "If it isn't there, open the menu (⋮), then Cast, save and share, then Install page as app.",
      "Click Install.",
    ],
    foot: "nine turtles opens in its own window, from your apps.",
  },
  edge: {
    where: "computer, in Edge",
    steps: ["Open the menu (…) at the top right, then Apps, then Install this site as an app.", "Click Install."],
    foot: "nine turtles opens in its own window, from your apps.",
  },
  firefox: {
    where: "computer, in Firefox",
    steps: [],
    foot: "Firefox on a computer can't install nine turtles yet. Open it in Chrome, Edge or Safari to install it, or pin this tab.",
  },
  other: {
    where: "device",
    steps: ["Open your browser's menu.", "Choose Install, Add to home screen or Add to Dock, whichever it offers."],
  },
};

/** The other devices, one line each, in this order; the reader's own is left out, since its steps are above. */
const OTHERS: { devices: Device[]; name: string; line: string }[] = [
  { devices: ["iphone", "ipad"], name: "iPhone and iPad", line: "In Safari, tap Share, then Add to Home Screen." },
  { devices: ["android"], name: "Android", line: "In Chrome, open the menu (⋮), then Add to home screen." },
  { devices: ["mac-safari"], name: "Mac", line: "In Safari, choose File, then Add to Dock." },
  { devices: ["chrome", "edge"], name: "Windows, Mac or Linux", line: "In Chrome or Edge, click the install icon in the address bar." },
];

export function otherDevices(device: Device): { name: string; line: string }[] {
  return OTHERS.filter((other) => !other.devices.includes(device));
}
