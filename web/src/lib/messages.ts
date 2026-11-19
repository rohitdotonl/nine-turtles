// The lines said again and again after an action or a failure, in the
// house style (BRAND.md → "Messages", decision 0199): one copy of each, so
// the same thing is always said the same way.

/** When nine turtles' own server can't be reached. */
export const UNREACHABLE = "nine turtles can't be reached right now. Try again in a moment.";

/** A successful Undo, everywhere. */
export const UNDONE = "Undone.";

/** How long a wait goes unsaid: a quicker answer never flickers a word (decision 0229). */
export const SAY_AFTER_MS = 500;

/** When a slow wait says it's still going, and when it says how long it can take (decision 0287). */
export const STILL_AFTER_MS = 5000;
export const LONG_AFTER_MS = 15_000;

/** A slow wait's line after 15 seconds: every lookup on someone else's site ends within a minute. */
export const UP_TO_A_MINUTE = "It can take up to a minute.";

/** `s`, `m`, `w` or `n` with no article chosen says what to do (decision 0230). */
export const CHOOSE_FIRST = "Choose an article first. j chooses the first one.";

/** `u` with nothing to undo says so, rather than nothing (decision 0229). */
export const NOTHING_TO_UNDO = "Nothing to undo.";

/** An Undo that couldn't reach nine turtles says so, rather than nothing. */
export const UNDO_FAILED = "That couldn't be undone. Try again in a moment.";

/** A password longer than the server takes (server/src/password.rs, MAXIMUM_LENGTH), said as every "too long" is: the thing, then its limit. */
export const passwordTooLong = (which = "password") => `That ${which} is too long. Keep it to 1,024 characters.`;

/** An email address that can't be one. */
export const NOT_AN_EMAIL = "That doesn't look like an email address.";

/** Signing up with an email that already has an account. */
export const HAS_ACCOUNT = "That email already has an account. Sign in instead.";

/** Following one more past the most one reader can (1,000 sources). */
export const TOO_MANY = "You follow 1,000 sources, as many as one reader can. Unsubscribe from one to follow another.";

/** Asked for the reader's own password and given none. */
export const PASSWORD_FIRST = "Type your password first.";

/** Asked for the reader's own password and given another. */
export const WRONG_PASSWORD = "That isn't your password.";

/** Too many wrong passwords; `wait` is how long, in words ("2 minutes"). */
export function tooManyTries(wait: string): string {
  return `Too many wrong tries. Try again in ${wait}.`;
}

/** The start of what Add says to an address it can't read; what follows says how to fix it (decision 0234). */
export const NOT_AN_ADDRESS = "That doesn't look like a web address.";
