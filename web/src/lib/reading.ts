// The reading settings shared across the reader's devices (SPEC section 18):
// the sort order, the reading mode, when unread lets go, the
// reader's keys and the lists the sidebar hides, with this device's copies
// so the app opens in them before the server answers.
import { HIDEABLE, type Hideable } from "./router";
import type { KeyMap } from "./keyboard";
import { getJson, isRecord } from "./http";
import { deviceJson, deviceText, setDeviceText } from "./device";
import { send } from "./saving";

/** The reader's sort order, shared across their devices (SPEC section 18). */
export type Order = "newest" | "oldest";

/**
 * Inbox (things to get through: the Unread view, read styling and the
 * sidebar's dots) or
 * river (things flowing past: none of those). Shared across the reader's
 * devices (SPEC section 10). Read state is recorded in both.
 */
export type ReadingMode = "inbox" | "river";

/** How long unread waits before it lets go by itself (decision 0097): never, the default, or a week, two or a month. */
export type LetGo = "never" | "week" | "two-weeks" | "month";

const LET_GO: LetGo[] = ["never", "week", "two-weeks", "month"];

/** Where the app opens, and where "/" leads: Unread in inbox mode, All in river mode. */
export function homeView(mode: ReadingMode): "unread" | "all" {
  return mode === "river" ? "all" : "unread";
}

/** The settings shared across the reader's devices (SPEC section 18). */
/** `letGo` is unknown when the server can't say, so its choices wait rather than show Never. */
export type Reading = {
  sort: Order;
  mode: ReadingMode;
  letGo: LetGo | undefined;
  keys: KeyMap;
  hidden: Hideable[];
};

/**
 * The settings shared across the reader's devices: the sort order, the
 * reading mode, when unread lets go, the keys
 * the reader chose and which lists the sidebar hides. Newest first if the
 * server can't say, the wait unknown, and the mode, keys and hidden
 * lists this device last saw (inbox, nine turtles' own keys, none,
 * if none).
 */
export async function loadSettings(): Promise<Reading> {
  try {
    const body = await getJson("/api/settings");
    const sort = isRecord(body) && body.sort === "oldest" ? "oldest" : "newest";
    const mode = isRecord(body) && body.mode === "river" ? "river" : "inbox";
    const letGo = (isRecord(body) && LET_GO.find((value) => value === body.let_go)) || "never";
    const keys = keysFrom(isRecord(body) ? body.keys : undefined);
    const hidden = isRecord(body) ? hiddenFrom(body.hidden) : [];
    rememberMode(mode);
    rememberKeys(keys);
    rememberHidden(hidden);
    return { sort, mode, letGo, keys, hidden };
  } catch {
    return { sort: "newest", mode: lastMode(), letGo: undefined, keys: lastKeys(), hidden: lastHidden() };
  }
}

/** The reader's keys, from the server or this device's copy: names and keys only, anything else left out. */
function keysFrom(value: unknown): KeyMap {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** Saves the reader's keys, all of them at once (decision 0110): `{}` puts every key back. */
export async function saveKeys(keys: KeyMap): Promise<void> {
  await send("/api/settings", { keys });
  rememberKeys(keys);
}
const KEYS_KEY = "nine-turtles.keys";

/** The keys this device last saw, so a changed key works from the first press, before the server answers, and offline. */
export function lastKeys(): KeyMap {
  return keysFrom(deviceJson(KEYS_KEY));
}

/** Signed out: this device forgets the keys, so whoever signs in next starts from their own (or nine turtles'). */
export function forgetKeys() {
  setDeviceText(KEYS_KEY, null);
}

/** The hidden lists named, in one order; anything else is left out. */
export function hiddenFrom(value: unknown): Hideable[] {
  if (!Array.isArray(value)) return [];
  return HIDEABLE.filter((list) => value.includes(list));
}

/** Hides lists from the sidebar, or shows them again (Settings › Show in the sidebar, decision 0105). */
export async function saveHidden(hidden: Hideable[]): Promise<void> {
  await send("/api/settings", { hidden });
  rememberHidden(hidden);
}

const HIDDEN_KEY = "nine-turtles.hidden";

/** The lists this device last saw hidden, so they don't show for a moment before the server answers. */
export function lastHidden(): Hideable[] {
  return hiddenFrom(deviceJson(HIDDEN_KEY));
}

function rememberHidden(hidden: Hideable[]) {
  setDeviceText(HIDDEN_KEY, JSON.stringify(hidden));
}

function rememberKeys(keys: KeyMap) {
  setDeviceText(KEYS_KEY, JSON.stringify(keys));
}

export function saveSort(sort: Order): Promise<void> {
  return send("/api/settings", { sort });
}

export async function saveMode(mode: ReadingMode): Promise<void> {
  await send("/api/settings", { mode });
  rememberMode(mode);
}

export function saveLetGo(letGo: LetGo): Promise<void> {
  return send("/api/settings", { let_go: letGo });
}

const MODE_KEY = "nine-turtles.mode";

/**
 * The reading mode this device last saw, so the app opens in it before the
 * server answers instead of showing Unread for a moment. The server's answer
 * decides.
 */
export function lastMode(): ReadingMode {
  return deviceText(MODE_KEY) === "river" ? "river" : "inbox";
}

function rememberMode(mode: ReadingMode) {
  setDeviceText(MODE_KEY, mode);
}
