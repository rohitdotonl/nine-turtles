// Installing nine turtles (SPEC section 20, decision 0151): which device and
// browser this is, and the steps that put nine turtles on its home screen,
// Dock, taskbar or app list. Read from the browser's own description of
// itself; a guess that's wrong only changes which steps come first, since
// every other device gets its own line too.

export type Platform = "iphone" | "ipad" | "android" | "mac" | "windows" | "linux" | "other";
export type BrowserName = "safari" | "chrome" | "edge" | "firefox" | "other";
export type Device = { platform: Platform; browser: BrowserName };

/** What the browser says about itself: its user agent and how many fingers its screen takes. */
export type Browser = { userAgent: string; maxTouchPoints: number };

function platformOf(ua: string, maxTouchPoints: number): Platform {
  if (/iPhone|iPod/.test(ua)) return "iphone";
  // An iPad asks for the desktop site, so it says "Macintosh"; only its touch screen gives it away.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return "ipad";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux|X11|CrOS/.test(ua)) return "linux";
  return "other";
}

function browserOf(ua: string): BrowserName {
  if (/Firefox\/|FxiOS\//.test(ua)) return "firefox";
  if (/Edg\/|EdgA\/|EdgiOS\//.test(ua)) return "edge";
  if (/Chrome\/|Chromium\/|CriOS\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

export function deviceOf({ userAgent, maxTouchPoints }: Browser): Device {
  return { platform: platformOf(userAgent, maxTouchPoints), browser: browserOf(userAgent) };
}

/** One device's steps: where they're for, and each press in order (or none, where it can't install). */
export type Guide = { where: string; steps: string[]; foot?: string };

const HOME_SCREEN = "nine turtles is on your home screen: open it from there.";
const OWN_WINDOW = "nine turtles opens in its own window, from your apps.";

const APPLE_PHONE = [
  "Tap Share: the square with an arrow pointing up. In Safari it may be under More (…).",
  "Scroll down if you need to, and tap Add to Home Screen.",
  "Tap Add.",
];

const CHROME = [
  "Click the install icon at the right end of the address bar: a screen with an arrow pointing down.",
  "If it isn't there, open the menu (⋮), then Cast, save and share, then Install page as app.",
  "Click Install.",
];

const EDGE = ["Open the menu (…) at the top right, then Apps, then Install this site as an app.", "Click Install."];

const COMPUTER: Record<string, string> = { mac: "Mac", windows: "Windows computer", linux: "Linux computer", other: "computer" };
const BROWSER: Record<BrowserName, string> = { safari: "Safari", chrome: "Chrome", edge: "Edge", firefox: "Firefox", other: "your browser" };

/** The steps for the device this page is open on. */
export function guideFor({ platform, browser }: Device): Guide {
  if (platform === "iphone" || platform === "ipad") {
    const where = platform === "iphone" ? "iPhone" : "iPad";
    return { where: browser === "safari" ? where : `${where}, in ${BROWSER[browser]}`, steps: APPLE_PHONE, foot: HOME_SCREEN };
  }
  if (platform === "android") {
    return {
      where: "Android phone",
      steps: ["Tap the browser's menu: the three dots at the top right.", "Tap Add to home screen, or Install app.", "Tap Install."],
      foot: HOME_SCREEN,
    };
  }
  const where = `${COMPUTER[platform]}, in ${BROWSER[browser]}`;
  if (browser === "chrome") return { where, steps: CHROME, foot: OWN_WINDOW };
  if (browser === "edge") return { where, steps: EDGE, foot: OWN_WINDOW };
  if (browser === "safari" && platform === "mac") {
    return {
      where,
      steps: ["In the menu bar, choose File, then Add to Dock.", "Click Add."],
      foot: "nine turtles is in your Dock and opens in its own window. This needs macOS Sonoma or later.",
    };
  }
  if (browser === "firefox" && platform === "windows") {
    return {
      where,
      steps: ["Click the web apps button at the right end of the address bar.", "Pin nine turtles to your taskbar if Firefox asks."],
      foot: "nine turtles is on your taskbar and in the Start menu. This needs Firefox 143 or later.",
    };
  }
  if (browser === "firefox") {
    return { where, steps: [], foot: `Firefox on a ${COMPUTER[platform]} can't install nine turtles yet. Open this page in Chrome or Edge to install it.` };
  }
  return { where, steps: ["Open your browser's menu.", "Choose Install, Add to home screen or Add to Dock, whichever it offers."] };
}

/** The three tabs of Settings › Install the app on any device, each a kind of device. */
export type Kind = "computer" | "android" | "apple";
export const KINDS: { kind: Kind; label: string }[] = [
  { kind: "computer", label: "Computer" },
  { kind: "android", label: "Android" },
  { kind: "apple", label: "iPhone & iPad" },
];

export function kindOf({ platform }: Device): Kind {
  if (platform === "android") return "android";
  if (platform === "iphone" || platform === "ipad") return "apple";
  return "computer";
}

/** A kind's steps when the reader isn't on it: every browser's way, since we can't know which they'll use there. */
export function guideForKind(kind: Kind): Guide {
  if (kind === "android") return guideFor({ platform: "android", browser: "chrome" });
  if (kind === "apple") return { where: "iPhone or iPad", steps: APPLE_PHONE, foot: HOME_SCREEN };
  return {
    where: "computer",
    steps: [
      "In Chrome or Edge, click the install icon at the right end of the address bar.",
      "In Safari on a Mac, choose File, then Add to Dock.",
      "In Firefox on Windows, click the web apps button in the address bar.",
    ],
    foot: "Firefox on a Mac or Linux can't install it yet: use Chrome or Edge there.",
  };
}

/** The key that shows the bookmarks bar where it's hidden. */
export function bookmarksBarKey({ platform }: Device): string {
  return platform === "mac" ? "⌘ Shift B" : "Ctrl Shift B";
}
