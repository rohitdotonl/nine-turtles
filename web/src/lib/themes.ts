// The themes from DESIGN.md → "Themes". The chosen theme is written to
// <html data-theme="…">; without it, the device's light/dark setting decides
// between off-white and dark (see app.css, which holds every theme's colors).
export const THEMES = [
  "off-white",
  "sepia",
  "porcelain",
  "linen",
  "mist",
  "sage",
  "dark",
  "graphite",
  "night",
  "midnight",
  "black",
] as const;

export type Theme = (typeof THEMES)[number];

/** The three themes slowfeed started with; the rest are being tried out. */
export const FIRST_THEMES: readonly Theme[] = ["off-white", "sepia", "dark"];

/**
 * Each theme's name, and its page, sidebar and text colors for its little
 * picture in Settings and the browser's bar. contrast.test.ts checks they
 * match app.css.
 */
export const LOOKS: Record<Theme, { label: string; page: string; side: string; ink: string }> = {
  "off-white": { label: "Off-white", page: "#f8f6f1", side: "#e7e2d7", ink: "#1f1e1c" },
  sepia: { label: "Sepia", page: "#f4ebd7", side: "#e3d5b7", ink: "#2a241b" },
  porcelain: { label: "Porcelain", page: "#ffffff", side: "#eeeeea", ink: "#1c1c1a" },
  linen: { label: "Linen", page: "#fbf8f1", side: "#e8e1d0", ink: "#22201b" },
  mist: { label: "Mist", page: "#f6f8fa", side: "#e3e9ee", ink: "#1b2027" },
  sage: { label: "Sage", page: "#f5f7f1", side: "#e1e7d8", ink: "#1d221b" },
  dark: { label: "Dark", page: "#1a1917", side: "#2e2a25", ink: "#e6e1d8" },
  graphite: { label: "Graphite", page: "#141414", side: "#232321", ink: "#ecebe6" },
  night: { label: "Night", page: "#16130f", side: "#25201a", ink: "#efe6d5" },
  midnight: { label: "Midnight", page: "#0f1420", side: "#1c2333", ink: "#e5e9f2" },
  black: { label: "Black", page: "#000000", side: "#161616", ink: "#e8e8e8" },
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
