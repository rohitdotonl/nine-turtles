// The four themes from DESIGN.md → "Themes": Original (decision 0056), Plain
// (decision 0063), Fountain pen and Signal (decisions 0136, 0145), each with a
// day ("light") and a night ("dark") version. It is written to
// <html data-theme="…"> and the version in use to data-mode (see
// preferences.ts; themes.css holds both versions' colors).
export const THEMES = ["original", "plain", "fountain-pen", "signal"] as const;

export type Theme = (typeof THEMES)[number];

/** Day or night: which version of a theme is showing. */
export type Mode = "light" | "dark";

/** The reader's Appearance choice: always day, always night, or as the device is set. */
export type Appearance = Mode | "auto";

export const APPEARANCES: { value: Appearance; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Match device" },
];

type Look = { page: string };

/**
 * Each theme's name, and per version its page color for
 * the browser's bar. contrast.test.ts checks they match themes.css.
 */
export const LOOKS: Record<Theme, { label: string } & Record<Mode, Look>> = {
  original: {
    label: "Original",
    light: { page: "#ffffff" },
    dark: { page: "#121212" },
  },
  plain: {
    label: "Plain",
    light: { page: "#ffffff" },
    dark: { page: "#121212" },
  },
  "fountain-pen": {
    label: "Fountain pen",
    light: { page: "#fafaf8" },
    dark: { page: "#171b24" },
  },
  signal: {
    label: "Signal",
    light: { page: "#ffffff" },
    dark: { page: "#181818" },
  },
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Themes that were retired, and the theme a reader who chose one now sees
 * (decision 0145): Brushed was closest to Original, Anodised and Heather to
 * Fountain pen. Saved choices are kept on the device, so this is read every
 * time preferences load, not run once.
 */
const RETIRED: Record<string, Theme> = {
  brushed: "original",
  anodised: "fountain-pen",
  heather: "fountain-pen",
};

/** A saved theme as a theme nine turtles still has: a retired one becomes its successor, anything unknown Original. */
export function savedTheme(value: unknown): Theme {
  if (isTheme(value)) return value;
  return typeof value === "string" && Object.hasOwn(RETIRED, value) ? RETIRED[value]! : "original";
}

export function isAppearance(value: unknown): value is Appearance {
  return value === "light" || value === "dark" || value === "auto";
}

/** The version showing: the reader's choice, or the device's setting for "Match device". */
export function resolveMode(appearance: Appearance, deviceDark: boolean): Mode {
  return appearance === "auto" ? (deviceDark ? "dark" : "light") : appearance;
}
