// The reading settings shared across the reader's devices (SPEC section 18):
// the sort order and whether Unread is on, with this device's copy of Unread so the app opens in it before
// the server answers.
import { getJson, isRecord } from "./http";
import { deviceText, setDeviceText } from "./device";
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
};

/**
 * The settings shared across the reader's devices: the sort order and whether
 * Unread is on. Newest first if the server can't say, and Unread as this
 * device last saw it (on, if it never has).
 */
export async function loadSettings(): Promise<Reading> {
  try {
    const body = await getJson("/api/settings");
    const sort = isRecord(body) && body.sort === "oldest" ? "oldest" : "newest";
    const unread = !(isRecord(body) && body.unread === false);
    rememberUnread(unread);
    // The lists this device once kept hidden (decision 0105) are no longer read (decision 0187).
    setDeviceText("nine-turtles.hidden", null);
    // The copy of a reader's own keys this device once kept (decision 0110) is no longer read (decision 0170).
    setDeviceText("nine-turtles.keys", null);
    return { sort, unread };
  } catch {
    return { sort: "newest", unread: lastUnread() };
  }
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
