// The pages from DESIGN.md → "Themes" (decision 0176): each theme is named by
// the page it gives, White, Paper or Night, and the reader picks the page
// itself, or Match device (the default), which shows White by day and Night
// by night as the device is set. The page showing is written to
// <html data-theme="…">, and whether it is a day or a night page to
// data-mode (see preferences.ts; themes.css holds each page's colors).
export const THEMES = ["white", "paper", "night"] as const;

/** A page nine turtles can show. */
export type Theme = (typeof THEMES)[number];

/** A day page or a night page: other styles (the night's lift, dimmed pictures) follow it. */
export type Mode = "light" | "dark";

/** The reader's choice: one of the pages, or Match device. */
export type Page = Theme | "auto";

/** The choices, in the order the Aa panel and Settings show them. */
export const PAGES: { value: Page; label: string }[] = [
  { value: "white", label: "White" },
  { value: "paper", label: "Paper" },
  { value: "night", label: "Night" },
  { value: "auto", label: "Match device" },
];

/**
 * Each page's name, whether it is a day or a night page, and its color for
 * the browser's bar. contrast.test.ts checks the colors match themes.css.
 */
export const LOOKS: Record<Theme, { label: string; mode: Mode; page: string }> = {
  white: { label: "White", mode: "light", page: "#ffffff" },
  paper: { label: "Paper", mode: "light", page: "#f7f3ea" },
  night: { label: "Night", mode: "dark", page: "#121212" },
};

export function isPage(value: unknown): value is Page {
  return typeof value === "string" && PAGES.some((choice) => choice.value === value);
}

/** The page showing: the reader's, or for Match device White by day and Night by night. */
export function showing(page: Page, deviceDark: boolean): Theme {
  return page === "auto" ? (deviceDark ? "night" : "white") : page;
}
