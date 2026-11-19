// Saving the reader's marks and settings one after another, in the order
// they were made, and trying again while nine turtles is out of reach (SPEC
// section 32, decision 0101).
import { OtherReader, api, changed } from "./updates.svelte";
import { noConnection, serverNow } from "./connection.svelte";
import { markSent, noteMark, sending } from "./offline";

// Marks are sent one after another, in the order they were made, so an undo
// can never overtake the mark it undoes. Counts wait for them, so the next
// ones already show them. Lists don't wait for marks (decision 0315): a list
// fetched while marks are on their way shows them anyway (`marksSince`), and
// waits only for other changes (a setting, a mute). Articles themselves never
// wait, so a slow save can't hold up reading. While nine turtles is out of
// reach and marks are waiting to try again, nothing waits for them: lists
// would fail anyway, and say so, rather than hang.
let writes: Promise<unknown> = Promise.resolve();
/** The last change other than a mark, once it's saved (or failed). */
let others: Promise<unknown> = Promise.resolve();

/** A mark made lately: when it was saved, or failed (`undefined` while on its way). */
export type Made = { kind: "read" | "starred"; ids: number[]; value: boolean; savedAt?: number };
/** Marks made lately, oldest first; each is forgotten a minute after it's saved. */
const made: Made[] = [];
const MADE_KEPT_MS = 60_000;

/** The marks a list fetched since `start` (`performance.now()`) might not show yet: those still on their way, or saved since. */
export function marksSince(start: number): Made[] {
  return made.filter((mark) => mark.savedAt === undefined || mark.savedAt >= start);
}

/** How many marks are still on their way: not yet saved, and not yet failed. A tab only switches to a new version once there are none. */
let unsavedMarks = 0;

/** Whether marks are still on their way to the server. */
export function marksUnsaved(): boolean {
  return unsavedMarks > 0;
}

/** Whether a save is waiting to try again, and who to tell when one starts. */
let retrying = false;
const waitingForSaves = new Set<() => void>();

/** Waits until every change sent so far has been saved (or has failed), or until saving has to wait to try again. */
export function saved(): Promise<unknown> {
  return waitFor(writes);
}

/** The same, for every change but marks (`marksSince` covers those). */
export function savedBesidesMarks(): Promise<unknown> {
  return waitFor(others);
}

function waitFor(chain: Promise<unknown>): Promise<unknown> {
  if (retrying) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      waitingForSaves.delete(done);
      resolve(undefined);
    };
    waitingForSaves.add(done);
    chain.then(done);
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

/** The server no longer knows this device's reader: signed out elsewhere, or the session ran out (decision 0230). */
export function signedOut(problem: unknown): boolean {
  return problem instanceof Refused && problem.status === 401;
}

/** Sends a change after the ones before it, trying again while nine turtles is out of reach. `mark`: a read or saved mark. */
export function send(path: string, body: unknown, mark = false): Promise<void> {
  // Now, not when its turn comes after the writes before it.
  changed();
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
  if (!mark) others = writes;
  return sent;
}

/** Marks articles read or unread. The screen has already changed; this tells the server. */
export function markRead(ids: number[], read: boolean): Promise<void> {
  return sendMark("read", ids, read, serverNow());
}

/** Saves articles or takes them out of Saved. The screen has already changed; this tells the server. */
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
  // Even when it waits on this device: lists fetched before it are out of date.
  changed();
  const noted = noteMark(kind, ids, value, at);
  const path = kind === "read" ? "/api/articles/read" : "/api/articles/starred";
  const body = kind === "read" ? { ids, read: value, at } : { ids, starred: value, at };
  const offline = globalThis.navigator?.onLine === false;
  const done = sending(kind, ids, at);
  const sent = offline ? Promise.reject(new TypeError("offline")) : send(path, body, true);
  sent.then(done, done);
  const mark: Made = { kind, ids, value };
  made.push(mark);
  const over = () => {
    mark.savedAt = performance.now();
    while (made[0]?.savedAt !== undefined && mark.savedAt - made[0].savedAt > MADE_KEPT_MS) made.shift();
  };
  sent.then(over, over);
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
