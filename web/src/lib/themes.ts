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

type Look = { page: string; side: string; ink: string };

/**
 * Each theme's name, and per version its page, sidebar and text colors for
 * the browser's bar. contrast.test.ts checks they match themes.css.
 */
export const LOOKS: Record<Theme, { label: string } & Record<Mode, Look>> = {
  original: {
    label: "Original",
    light: { page: "#ffffff", side: "#efeff1", ink: "#141414" },
    dark: { page: "#121212", side: "#232323", ink: "#e8e8e8" },
  },
  plain: {
    label: "Plain",
    light: { page: "#ffffff", side: "#f5f5f5", ink: "#000000" },
    dark: { page: "#121212", side: "#1c1c1c", ink: "#ffffff" },
  },
  brushed: {
    label: "Brushed",
    light: { page: "#fafaf9", side: "#e6e6e3", ink: "#18181a" },
    dark: { page: "#1b1b1c", side: "#29292b", ink: "#ececea" },
  },
  anodised: {
    label: "Anodised",
    light: { page: "#f8f9fa", side: "#e3e7eb", ink: "#141a21" },
    dark: { page: "#191c20", side: "#272c32", ink: "#e9edf2" },
  },
  "fountain-pen": {
    label: "Fountain pen",
    light: { page: "#fafaf8", side: "#e6e6e1", ink: "#152039" },
    dark: { page: "#171b24", side: "#232937", ink: "#e6eaf3" },
  },
  heather: {
    label: "Heather",
    light: { page: "#faf9fb", side: "#e6e4eb", ink: "#1b1a21" },
    dark: { page: "#1c1b20", side: "#2a2830", ink: "#edebf1" },
  },
  signal: {
    label: "Signal",
    light: { page: "#ffffff", side: "#ebebea", ink: "#111111" },
    dark: { page: "#181818", side: "#262626", ink: "#eeeeee" },
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
