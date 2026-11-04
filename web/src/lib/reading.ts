// The reading settings shared across the reader's devices (SPEC section 18):
// the sort order, whether Unread is on and the lists the sidebar hides, with this device's copies so the app opens in them before
// the server answers.
import { HIDEABLE, type Hideable } from "./router";
import { getJson, isRecord } from "./http";
import { deviceJson, deviceText, setDeviceText } from "./device";
import { send } from "./saving";

/** The reader's sort order, shared across their devices (SPEC section 18). */
export type Order = "newest" | "oldest";

/** Where the app opens, and where "/" leads: Unread, or All with Unread off (SPEC section 10). */
export function homeView(unread: boolean): "unread" | "all" {
  return unread ? "unread" : "all";
}

/** The settings shared across the reader's devices (SPEC section 18). */
export type Reading = {
  sort: Order;
  /**
   * Unread on: the Unread list, read styling and the sidebar's dots. Off:
   * none of those. Read state is recorded either way (SPEC section 10).
   */
  unread: boolean;
  /** The reader had keys of their own, now back to nine turtles' (step 5 of the owner's review), and hasn't been told. */
  keysReset: boolean;
  hidden: Hideable[];
};

/**
 * The settings shared across the reader's devices: the sort order, whether
 * Unread is on and which lists the sidebar hides. Newest first if the
 * server can't say, and Unread and the hidden lists as this device last saw them (on and none, if none).
 */
export async function loadSettings(): Promise<Reading> {
  try {
    const body = await getJson("/api/settings");
    const sort = isRecord(body) && body.sort === "oldest" ? "oldest" : "newest";
    const unread = !(isRecord(body) && body.unread === false);
    const keysReset = isRecord(body) && body.keys_reset === true;
    const hidden = isRecord(body) ? hiddenFrom(body.hidden) : [];
    rememberUnread(unread);
    rememberHidden(hidden);
    // The copy of a reader's own keys this device once kept (decision 0110) is no longer read (decision 0170).
    setDeviceText("nine-turtles.keys", null);
    return { sort, unread, keysReset, hidden };
  } catch {
    return { sort: "newest", unread: lastUnread(), keysReset: false, hidden: lastHidden() };
  }
}

/** The reader has been told their own keys are gone: the server removes them, and doesn't tell again. */
export function saveKeysSeen(): Promise<void> {
  return send("/api/settings", { keys_seen: true });
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

export function saveSort(sort: Order): Promise<void> {
  return send("/api/settings", { sort });
}

export async function saveUnread(unread: boolean): Promise<void> {
  await send("/api/settings", { unread });
  rememberUnread(unread);
}

const UNREAD_KEY = "nine-turtles.unread";

/**
 * Whether Unread was on when this device last saw, so the app opens as it
 * was before the server answers instead of showing Unread for a moment. The
 * server's answer decides.
 */
export function lastUnread(): boolean {
  return deviceText(UNREAD_KEY) !== "off";
}

function rememberUnread(unread: boolean) {
  setDeviceText(UNREAD_KEY, unread ? "on" : "off");
  // What this device kept when the choice was called inbox or river is no longer read (decision 0172).
  setDeviceText("nine-turtles.mode", null);
}
