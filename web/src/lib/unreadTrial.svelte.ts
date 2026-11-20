/*
  TRIAL ONLY (screen refine 1, the Unread list): a picker that switches Unread between the
  directions Rohit is choosing from, on this device. Removed before anything ships.
*/
export const LOOKS = [
  ["now", "Today"],
  ["margin", "Names in the margin, today's spacing"],
  ["margin-mid", "Names in the margin, a little tighter"],
  ["cards", "Cards, today's spacing"],
] as const;
export type Look = (typeof LOOKS)[number][0];

const KEY = "nine-turtles.trial-unread";
function read<T>(key: string, fallback: T): T {
  try {
    const kept = localStorage.getItem(key);
    return kept ? (JSON.parse(kept) as T) : fallback;
  } catch {
    return fallback;
  }
}
function keep(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* nothing to keep it in */
  }
}

export const trial = $state({ look: read<Look>(KEY, "now"), open: read<string[]>(KEY + "-open", []) });

export function setLook(look: Look) {
  trial.look = look;
  keep(KEY, look);
  document.documentElement.dataset.look = look;
}
document.documentElement.dataset.look = trial.look;

/** Names first: whose titles are showing. */
export function toggleOpen(name: string) {
  trial.open = trial.open.includes(name) ? trial.open.filter((n) => n !== name) : [...trial.open, name];
  keep(KEY + "-open", trial.open);
}
