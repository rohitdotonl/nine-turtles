// Answers that come back out of order. Two small helpers so a slow, older
// answer never overwrites what a newer one put on screen.

/**
 * Saves one thing the reader changes (a setting, Up Next's order) so the newest
 * change wins. The screen shows each change at once (`show`); the saves go to
 * the server one at a time, in the order they were made, so the server ends on
 * the newest. When a save fails and no newer change is on its way, the screen
 * goes back to what the server last kept; a failure with a newer change behind
 * it leaves the screen alone. A save may answer what the server kept (Up Next
 * does), which the screen then shows; otherwise what was sent counts.
 *
 * The returned function takes the new value and the one on screen before it,
 * and rejects when its own save failed and it is still the newest change (an
 * older failure ends quietly, so "couldn't be saved" never shows for a choice
 * the reader has already replaced).
 */
export function savedInOrder<T>(save: (value: T) => Promise<T | void>, show: (value: T) => void) {
  let queue: Promise<unknown> = Promise.resolve();
  let made = 0;
  let pending = 0;
  let kept: T;
  return function change(next: T, before: T): Promise<void> {
    const ticket = ++made;
    // With nothing on its way, what's on screen is what the server has.
    if (pending === 0) kept = before;
    pending++;
    show(next);
    const saving = queue.then(() => save(next));
    queue = saving.catch(() => undefined);
    return saving.then(
      (answer) => {
        pending--;
        kept = answer === undefined ? next : answer;
        if (ticket === made) show(kept);
      },
      (failure: unknown) => {
        pending--;
        // A newer change is on its way: it alone says how saving went.
        if (ticket !== made) return;
        show(kept);
        throw failure;
      },
    );
  };
}

/**
 * Loads something that may be asked for again before it arrives (the feeds,
 * saved searches, collections). Every caller gets the answer to the newest ask:
 * one started earlier waits for it rather than handing back an older list, which
 * could, say, briefly put an unsubscribed feed back in the sidebar.
 */
export function newestAnswer<T>(load: () => Promise<T>): () => Promise<T> {
  let newest: Promise<T> | undefined;
  async function answer(): Promise<T> {
    const asked = newest as Promise<T>;
    try {
      const value = await asked;
      if (asked === newest) return value;
    } catch (failure) {
      if (asked === newest) throw failure;
    }
    return answer();
  }
  return () => {
    newest = load();
    return answer();
  };
}
