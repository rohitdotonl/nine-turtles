// The themes from DESIGN.md → "Themes": Original (decision 0056), Plain
// (decision 0063) and five after Braun's colors, each with a day ("light") and a night ("dark") version. It is written to
// <html data-theme="…"> and the version in use to data-mode (see
// preferences.ts; themes.css holds both versions' colors).
export const THEMES = ["original", "plain", "brushed", "anodised", "fountain-pen", "heather", "signal"] as const;

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
  brushed: {
    label: "Brushed",
    light: { page: "#fafaf9" },
    dark: { page: "#1b1b1c" },
  },
  anodised: {
    label: "Anodised",
    light: { page: "#f8f9fa" },
    dark: { page: "#191c20" },
  },
  "fountain-pen": {
    label: "Fountain pen",
    light: { page: "#fafaf8" },
    dark: { page: "#171b24" },
  },
  heather: {
    label: "Heather",
    light: { page: "#faf9fb" },
    dark: { page: "#1c1b20" },
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

export function isAppearance(value: unknown): value is Appearance {
  return value === "light" || value === "dark" || value === "auto";
}

/** The version showing: the reader's choice, or the device's setting for "Match device". */
export function resolveMode(appearance: Appearance, deviceDark: boolean): Mode {
  return appearance === "auto" ? (deviceDark ? "dark" : "light") : appearance;
}
