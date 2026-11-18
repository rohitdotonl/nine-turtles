// Replies you started (SPEC section 37, decision 0307): when the reader
// presses any way back at an article's end, nine turtles notes the article
// and the day, so the person's page can list it. Never what was written, and
// never whether it was sent: nine turtles can't know. Switched off in
// Settings, the server notes nothing.

import { sendChange } from "./http";

/** A way back was pressed at this article's end. Quietly does nothing when it can't be noted: the reply itself matters, not the note of it. */
export function replyStarted(article: number): void {
  void sendChange(`/api/articles/${article}/reply-started`, {}, []);
}

/** Removes one line from their page; false when it couldn't be. */
export async function forgetReply(article: number): Promise<boolean> {
  return (await sendChange(`/api/articles/${article}/reply-started/delete`, {}, [])).refusal === undefined;
}

/** Undo after Remove: the line comes back with the day it had; false when it couldn't. */
export async function restoreReply(article: number, at: number): Promise<boolean> {
  return (await sendChange(`/api/articles/${article}/reply-started`, { at }, [])).refusal === undefined;
}
