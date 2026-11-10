// The lines said again and again after an action or a failure, in the
// house style (BRAND.md → "Messages", decision 0199): one copy of each, so
// the same thing is always said the same way.

/** When nine turtles' own server can't be reached. */
export const UNREACHABLE = "nine turtles can't be reached right now. Try again in a moment.";

/** A successful Undo, everywhere. */
export const UNDONE = "Undone.";

/** `u` with nothing to undo says so, rather than nothing (decision 0229). */
export const NOTHING_TO_UNDO = "Nothing to undo.";

/** An Undo that couldn't reach nine turtles says so, rather than nothing. */
export const UNDO_FAILED = "That couldn't be undone. Try again in a moment.";

/** Asked for the reader's own password and given none. */
export const PASSWORD_FIRST = "Type your password first.";

/** Asked for the reader's own password and given another. */
export const WRONG_PASSWORD = "That isn't your password.";

/** Too many wrong passwords; `wait` is how long, in words ("2 minutes"). */
export function tooManyTries(wait: string): string {
  return `Too many wrong tries. Try again in ${wait}.`;
}
