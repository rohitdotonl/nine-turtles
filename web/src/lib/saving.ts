// Saving the reader's marks and settings one after another, in the order
// they were made, and trying again while nine turtles is out of reach (SPEC
// section 32, decision 0101).
import { OtherReader, api } from "./updates.svelte";
import { noConnection, serverNow } from "./connection.svelte";
import { markSent, noteMark, sending } from "./offline";

// Marks are sent one after another, in the order they were made, so an undo
// can never overtake the mark it undoes. Lists and counts wait for them, so
// a list opened next already shows them; articles themselves never wait, so
// a slow save can't hold up reading. While nine turtles is out of reach and
// marks are waiting to try again, nothing waits for them: lists would fail
// anyway, and say so, rather than hang.
let writes: Promise<unknown> = Promise.resolve();

/** How many marks are still on their way: not yet saved, and not yet failed. A tab only switches to a new version once there are none. */
let unsavedMarks = 0;

/** Whether marks are still on their way to the server. */
export function marksUnsaved(): boolean {
  return unsavedMarks > 0;
}

/** Whether a save is waiting to try again, and who to tell when one starts. */
let retrying = false;
const waitingForSaves = new Set<() => void>();

/** Waits until every mark sent so far has been saved (or has failed), or until saving has to wait to try again. */
export function saved(): Promise<unknown> {
  if (retrying) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      waitingForSaves.delete(done);
      resolve(undefined);
    };
    waitingForSaves.add(done);
    writes.then(done);
  });
}

/**
 * How long saves keep trying while nine turtles can't be reached: about a
 * minute, longer than the server takes to restart when a new version goes
 * live, so a mark made in that moment is saved, not lost. The minute counts
 * from when the mark was made, not from its first try, so marks queued
 * behind one another never add their minutes up.
 */
export const KEEP_TRYING_FOR = 60_000;
/** The pauses between tries, the last repeating; never past the minute. */
export const RETRY_AFTER = [1_000, 2_000, 4_000, 8_000, 15_000];
const LAST_PAUSE = 15_000;

/**
 * Answers meaning "nine turtles is out of reach for a moment" (a restart, or
 * the host's front door between it and you), worth trying again. Any other
 * answer is final.
 */
const OUT_OF_REACH = new Set([502, 503, 504]);

/** The server answered, but not with yes. */
export class Refused extends Error {
  constructor(readonly status: number) {
    super(`nine turtles answered ${status}`);
  }
}

/** Whether a failed save is worth trying again: the connection, a timeout or a restart, never a refusal. */
export function worthRetrying(problem: unknown): boolean {
  // Another reader is signed in on this browser: no try from this tab will be taken.
  if (problem instanceof OtherReader) return false;
  return !(problem instanceof Refused) || OUT_OF_REACH.has(problem.status);
}

export function send(path: string, body: unknown): Promise<void> {
  const giveUpAt = Date.now() + KEEP_TRYING_FOR;
  const once = async () => {
    const response = await api(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // A try that hangs counts as failed, so the next one can start.
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Refused(response.status);
  };
  const sent = writes.then(async () => {
    for (let tries = 0; ; tries++) {
      try {
        return await once();
      } catch (problem) {
        if (!worthRetrying(problem)) throw problem;
        const left = giveUpAt - Date.now();
        if (left <= 0) throw problem;
        retrying = true;
        for (const done of [...waitingForSaves]) done();
        try {
          await new Promise((resolve) => setTimeout(resolve, Math.min(left, RETRY_AFTER[tries] ?? LAST_PAUSE)));
        } finally {
          retrying = false;
        }
      }
    }
  });
  unsavedMarks++;
  const settled = () => void unsavedMarks--;
  sent.then(settled, settled);
  writes = sent.catch(() => undefined);
  return sent;
}

/** Marks articles read or unread. The screen has already changed; this tells the server. */
export function markRead(ids: number[], read: boolean): Promise<void> {
  return sendMark("read", ids, read, serverNow());
}

/** Stars or unstars articles. The screen has already changed; this tells the server. */
export function markStarred(ids: number[], starred: boolean): Promise<void> {
  return sendMark("starred", ids, starred, serverNow());
}

/**
 * Sends a mark, saying when it was made, so the latest mark wins (decision
 * 0101). It's written down on this device first: if there's no connection,
 * it waits there and is sent once there is (SPEC section 32), rather than
 * being taken back. Without a connection, nothing is tried until then.
 */
function sendMark(kind: "read" | "starred", ids: number[], value: boolean, at: number): Promise<void> {
  const noted = noteMark(kind, ids, value, at);
  const path = kind === "read" ? "/api/articles/read" : "/api/articles/starred";
  const body = kind === "read" ? { ids, read: value, at } : { ids, starred: value, at };
  const offline = globalThis.navigator?.onLine === false;
  const done = sending(kind, ids, at);
  const sent = offline ? Promise.reject(new TypeError("offline")) : send(path, body);
  sent.then(done, done);
  return sent.then(
    async () => {
      await noted;
      await markSent(kind, ids, at);
    },
    async (problem) => {
      if (noConnection(problem) && (await noted)) return;
      await noted;
      await markSent(kind, ids, at);
      throw problem;
    },
  );
}
