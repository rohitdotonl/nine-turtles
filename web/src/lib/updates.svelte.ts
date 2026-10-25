// New versions of nine turtles (SPEC section 18, Status). Every answer from the
// server says which version sent it. The first answer this tab gets is the
// version it runs; when a later one names another, a newer nine turtles is
// live: Settings says "A new version is ready", with Reload. Nothing is
// swapped while you read: the tab switches to the new version by itself the
// next time you go to another place, which redraws the screen anyway, and
// only once every mark has been saved and no Undo is on offer (decision
// 0085). If the newer nine turtles refuses a request because it no longer
// understands it, the note at the bottom of the list says "nine turtles was
// updated. Reload to continue."
//
// A tab asks which version is live when it comes back into view and every
// few minutes while it's in view, so even a tab left open for days notices.

export const VERSION_HEADER = "x-nine-turtles-version";

/** Statuses meaning "I don't understand that request", rather than an answer the screens explain. */
const NOT_UNDERSTOOD = new Set([400, 404, 405, 415, 422]);

export type Verdict = "same" | "newer" | "stranded";

/** What one answer says about this tab's version. */
export function verdict(running: string | undefined, answered: string | null, status: number): Verdict {
  if (!running || !answered || answered === running) return "same";
  return NOT_UNDERSTOOD.has(status) ? "stranded" : "newer";
}

export const updates = $state({ ready: false, stranded: false });

let running: string | undefined;

/** Reads an answer's version; the first one seen is this tab's own. */
export function noteAnswer(response: Response) {
  const answered = response.headers.get(VERSION_HEADER);
  running ??= answered ?? undefined;
  const said = verdict(running, answered, response.status);
  if (said !== "same") updates.ready = true;
  if (said === "stranded") updates.stranded = true;
}

/** `fetch`, for nine turtles' own server, noting each answer's version. */
export async function api(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  noteAnswer(response);
  return response;
}

/** The message for the note at the bottom of the list, once this tab can't carry on. */
export const STRANDED_MESSAGE = "nine turtles was updated. Reload to continue.";

/** How often a tab in view asks which version is live, when nothing else has asked. */
export const CHECK_EVERY_MS = 5 * 60_000;

/**
 * Whether going to another place should load the new version instead: only
 * when one is live, every mark has been saved, and no Undo would be lost.
 */
export function switchesOnMove(ready: boolean, marksUnsaved: boolean, undoOnOffer: boolean): boolean {
  return ready && !marksUnsaved && !undoOnOffer;
}

/**
 * What the screen looked like, carried to the page that loads next so the
 * switch leaves it as the reader arranged it: whether the keyboard was in
 * use, the panes they hid, the list Settings goes back to, and how far the
 * sidebar was scrolled.
 */
export type Carried = {
  keyboard: boolean;
  sidebar: "auto" | "hidden" | "shown";
  listHidden: boolean;
  lastPlace: string;
  sidebarScroll: number;
};

/** Remembers, for the page that loads next, that it came from switching versions. */
const SWITCHED_KEY = "nine-turtles-switched";

/** Loads the new version at `path`, so the reader arrives where they were going. */
export function switchTo(path: string, carried: Carried) {
  try {
    sessionStorage.setItem(SWITCHED_KEY, JSON.stringify(carried));
  } catch {
    // Without it the new version still opens, as a fresh page would.
  }
  location.assign(path);
}

/** What the page before carried, if this page opened by switching versions. */
export function arrivedBySwitching(): Carried | undefined {
  try {
    const kept = sessionStorage.getItem(SWITCHED_KEY);
    sessionStorage.removeItem(SWITCHED_KEY);
    return kept ? readCarried(JSON.parse(kept)) : undefined;
  } catch {
    return undefined;
  }
}

/** Only a note this code wrote counts; anything else is ignored. */
export function readCarried(value: unknown): Carried | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { keyboard, sidebar, listHidden, lastPlace, sidebarScroll } = value as Record<string, unknown>;
  if (typeof keyboard !== "boolean" || typeof listHidden !== "boolean") return undefined;
  if (sidebar !== "auto" && sidebar !== "hidden" && sidebar !== "shown") return undefined;
  if (typeof lastPlace !== "string" || typeof sidebarScroll !== "number" || !Number.isFinite(sidebarScroll)) return undefined;
  return { keyboard, sidebar, listHidden, lastPlace, sidebarScroll };
}

/** Asks which version is live: on coming back into view, and every few minutes in view. Returns a stop function. */
export function watchForNewVersions(): () => void {
  const ask = () => {
    if (updates.ready || document.hidden) return;
    api("/api/session", { cache: "no-store" }).catch(() => {
      // Out of reach for now: it asks again later.
    });
  };
  const shown = () => {
    if (!document.hidden) ask();
  };
  document.addEventListener("visibilitychange", shown);
  const asking = setInterval(ask, CHECK_EVERY_MS);
  return () => {
    document.removeEventListener("visibilitychange", shown);
    clearInterval(asking);
  };
}
