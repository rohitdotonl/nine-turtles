// The themes from DESIGN.md → "Themes" (decision 0046), as in Apple Books:
// six, each with a day ("light") and a night ("dark") version. The chosen
// theme is written to <html data-theme="…"> and the version in use to
// data-mode (see preferences.ts; app.css holds every version's colors).
export const THEMES = ["original", "quiet", "paper", "bold", "calm", "focus"] as const;

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
 * its tile in Settings and the browser's bar. contrast.test.ts checks they
 * match app.css.
 */
export const LOOKS: Record<Theme, { label: string } & Record<Mode, Look>> = {
  original: {
    label: "Original",
    light: { page: "#ffffff", side: "#efeff1", ink: "#141414" },
    dark: { page: "#121212", side: "#232323", ink: "#e8e8e8" },
  },
  quiet: {
    label: "Quiet",
    light: { page: "#e8e8ea", side: "#d7d7db", ink: "#2a2a2d" },
    dark: { page: "#2c2c2e", side: "#38383b", ink: "#e2e2e5" },
  },
  paper: {
    label: "Paper",
    light: { page: "#f5f4f0", side: "#e4e3dd", ink: "#25241f" },
    dark: { page: "#262624", side: "#343431", ink: "#e3e1d9" },
  },
  bold: {
    label: "Bold",
    light: { page: "#ffffff", side: "#efeff1", ink: "#000000" },
    dark: { page: "#000000", side: "#161616", ink: "#ffffff" },
  },
  calm: {
    label: "Calm",
    light: { page: "#f2e6d0", side: "#e0d0b2", ink: "#32271b" },
    dark: { page: "#29231c", side: "#382f27", ink: "#eadcc5" },
  },
  focus: {
    label: "Focus",
    light: { page: "#fbf6e2", side: "#eae2c6", ink: "#1f1d16" },
    dark: { page: "#1b1a15", side: "#2a2821", ink: "#e7e1cc" },
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
 * The themes before decision 0046, and the new theme and Appearance each
 * one's reader keeps, so nobody loses their choice: the nearest in color.
 */
export const OLD_THEMES: Record<string, { theme: Theme; appearance: Appearance }> = {
  system: { theme: "original", appearance: "auto" },
  "off-white": { theme: "paper", appearance: "light" },
  sepia: { theme: "calm", appearance: "light" },
  porcelain: { theme: "original", appearance: "light" },
  linen: { theme: "paper", appearance: "light" },
  mist: { theme: "quiet", appearance: "light" },
  sage: { theme: "focus", appearance: "light" },
  dark: { theme: "calm", appearance: "dark" },
  graphite: { theme: "quiet", appearance: "dark" },
  night: { theme: "calm", appearance: "dark" },
  midnight: { theme: "original", appearance: "dark" },
  black: { theme: "bold", appearance: "dark" },
};
