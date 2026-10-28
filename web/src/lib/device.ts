// Small settings this device keeps for itself, in the browser's local
// storage: the chosen keys, open folders, widths, playback speed and the
// like. A private window or a browser with storage turned off may refuse;
// then nothing is kept and each setting falls back to its default, while
// anything the server keeps still decides.

/** The browser's storage, or nothing when it refuses: for code that takes a storage so tests can give their own. */
export function deviceStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** What this device keeps under `key`, or null when nothing is kept or the browser refuses. */
export function deviceText(key: string): string | null {
  try {
    return deviceStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** What this device keeps under `key`, read as JSON; undefined when nothing readable is kept. */
export function deviceJson(key: string): unknown {
  const saved = deviceText(key);
  if (saved === null) return undefined;
  try {
    return JSON.parse(saved) as unknown;
  } catch {
    return undefined;
  }
}

/** Keeps `value` under `key` on this device; null forgets it. Does nothing when the browser refuses. */
export function setDeviceText(key: string, value: string | null): void {
  try {
    if (value === null) deviceStorage()?.removeItem(key);
    else deviceStorage()?.setItem(key, value);
  } catch {
    // Not kept on this device: the setting holds for as long as this tab is open.
  }
}
