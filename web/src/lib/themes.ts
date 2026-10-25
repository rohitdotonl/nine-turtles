// The themes from DESIGN.md → "Themes": Original (decision 0056) and Plain
// (decision 0062), each with a day ("light") and a night ("dark") version. It is written to
// <html data-theme="…"> and the version in use to data-mode (see
// preferences.ts; app.css holds both versions' colors).
export const THEMES = ["original", "plain"] as const;

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
 * the browser's bar. contrast.test.ts checks they match app.css.
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

/**
 * Themes saved by earlier versions all become Original (decision 0056). The
 * Appearance is the one saved with them; a theme from before decision 0046
 * had none, so it gets the nearest: day for a light theme, night for a dark one.
 */
export const OLD_THEMES: Record<string, { theme: Theme; appearance: Appearance }> = {
  // Decision 0046's themes, removed by decision 0056.
  quiet: { theme: "original", appearance: "auto" },
  paper: { theme: "original", appearance: "auto" },
  bold: { theme: "original", appearance: "auto" },
  calm: { theme: "original", appearance: "auto" },
  focus: { theme: "original", appearance: "auto" },
  // The themes before decision 0046.
  system: { theme: "original", appearance: "auto" },
  "off-white": { theme: "original", appearance: "light" },
  sepia: { theme: "original", appearance: "light" },
  porcelain: { theme: "original", appearance: "light" },
  linen: { theme: "original", appearance: "light" },
  mist: { theme: "original", appearance: "light" },
  sage: { theme: "original", appearance: "light" },
  dark: { theme: "original", appearance: "dark" },
  graphite: { theme: "original", appearance: "dark" },
  night: { theme: "original", appearance: "dark" },
  midnight: { theme: "original", appearance: "dark" },
  black: { theme: "original", appearance: "dark" },
};
