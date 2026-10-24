// New versions of nine turtles (SPEC section 18, Status). Every answer from the
// server says which version sent it. The first answer this tab gets is the
// version it runs; when a later one names another, a newer nine turtles is
// live: Settings says "A new version is ready", with Reload. Nothing is
// swapped while you read. If the newer nine turtles refuses a request because
// it no longer understands it, the note at the bottom of the list says "nine turtles was
// updated. Reload to continue." (Keeping such a tab working without a
// reload is V2.)

export const VERSION_HEADER = "x-slowfeed-version";

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
