// "Or try one" in the first-visit welcome (SPEC section 2, decision 0198): three
// example addresses, a blog, a newsletter and a YouTube channel, the same for
// every reader. Pressing one follows it at once, through the same path as
// pasting its address, and the welcome stays to show that person's newest post
// right there, until the reader goes anywhere else in the app.

import type { Feed } from "./shapes";
import { addFeed, explain } from "./feeds";

export type Example = {
  /** In small capitals before the address. */
  kind: string;
  /** What the reader would paste. */
  address: string;
};

export const EXAMPLES: readonly Example[] = [
  { kind: "Blog", address: "www.rohit.onl" },
  { kind: "Newsletter", address: "jmarriott.substack.com" },
  { kind: "YouTube", address: "youtube.com/@TwoCentsPBS" },
];

/** Followed from an example, with their newest post's title when the feed had one. */
export type Tried = { feed: Feed; latest?: string };

/** The one just followed, and the examples already pressed (they leave the list). */
export const trying: { current?: Tried; done: string[] } = $state({ done: [] });

/** The welcome gives way: the reader has gone somewhere else in the app. */
export function stopTrying() {
  trying.current = undefined;
}

/** The examples not yet pressed. */
export function examplesLeft(): Example[] {
  return EXAMPLES.filter((example) => !trying.done.includes(example.address));
}

/**
 * Follows an example. A site offering several feeds takes its first, as Add's
 * own choice starts on it. Answers what to say, and whether it's a problem.
 */
export async function tryExample(example: Example, add: typeof addFeed = addFeed): Promise<{ message: string; problem: boolean }> {
  let result = await add(example.address);
  if (result.kind === "choose" && result.choices[0]) result = await add(result.choices[0].url);
  if (result.kind === "added") {
    trying.current = { feed: result.feed, ...(result.latest ? { latest: result.latest } : {}) };
    trying.done.push(example.address);
    return { message: `You're following ${result.feed.title}.`, problem: false };
  }
  if (result.kind === "already") return { message: "You already follow this.", problem: false };
  if (result.kind === "problem") return { message: explain(result.reason), problem: true };
  return { message: `${example.address} couldn't be added just now. Try again later.`, problem: true };
}
