// The three themes from DESIGN.md → "Themes". The chosen theme is written to
// <html data-theme="…">; without it, the device's light/dark setting decides
// between off-white and dark (see app.css).
export const THEMES = ["off-white", "sepia", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
