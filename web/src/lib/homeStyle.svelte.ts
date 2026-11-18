// Home redesign, design round only (thread "Redesign Home for clarity"): which of the two versions shows, and
// who is pinned. Both live on this device for now, so Rohit can try them; the version chosen is built properly
// (pins kept on the server, per reader) before anything ships.

export type HomeStyle = "now" | "safe" | "bold";

const STYLE_KEY = "nine-turtles-home-style";
const PINS_KEY = "nine-turtles-pins";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private window: it lasts until the page closes.
  }
}

function startingStyle(): HomeStyle {
  const asked = new URLSearchParams(location.search).get("home");
  if (asked === "now" || asked === "safe" || asked === "bold") {
    write(STYLE_KEY, asked);
    return asked;
  }
  const kept = read(STYLE_KEY);
  return kept === "now" || kept === "bold" ? kept : "safe";
}

function startingPins(): number[] {
  try {
    const kept = JSON.parse(read(PINS_KEY) ?? "[]");
    return Array.isArray(kept) ? kept.filter((each) => typeof each === "number") : [];
  } catch {
    return [];
  }
}

/** Up to nine, in the order pinned; never filled by the app. */
export const PIN_LIMIT = 9;

export const home = $state({ style: startingStyle(), pins: startingPins() });

export function setStyle(style: HomeStyle) {
  home.style = style;
  write(STYLE_KEY, style);
}

export function isPinned(id: number): boolean {
  return home.pins.includes(id);
}

/** Pins or unpins someone; false when nine are pinned already. */
export function togglePin(id: number): boolean {
  if (isPinned(id)) home.pins = home.pins.filter((each) => each !== id);
  else if (home.pins.length >= PIN_LIMIT) return false;
  else home.pins = [...home.pins, id];
  write(PINS_KEY, JSON.stringify(home.pins));
  return true;
}
