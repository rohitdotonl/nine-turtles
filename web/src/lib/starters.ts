/**
 * The "New to feeds?" starters (SPEC section 2, decision 0079): a short,
 * fixed list shown only in the first-visit welcome, the same for every
 * reader, so a newcomer can see how feeds work before choosing their own.
 * Nothing here is ranked or chosen for anyone, and none is added unless the
 * reader ticks it. Each address is the publisher's own feed, so adding one
 * never looks at a web page (decision 0016).
 */

import type { Feed } from "./shapes";
import { addFeed } from "./feeds";

export type Starter = {
  name: string;
  /** One quiet line on what it publishes. */
  about: string;
  /** The publisher's own feed address. */
  feed: string;
};

export const STARTERS: readonly Starter[] = [
  { name: "The Marginalian", about: "Maria Popova on books, art and ideas", feed: "https://www.themarginalian.org/feed/" },
  { name: "The Public Domain Review", about: "Old art, books and curiosities, with essays", feed: "https://publicdomainreview.org/rss.xml" },
  { name: "kottke.org", about: "A little of everything, found by Jason Kottke", feed: "https://feeds.kottke.org/main" },
  { name: "Austin Kleon", about: "Notes on reading, drawing and making things", feed: "https://austinkleon.com/feed/" },
  { name: "NASA Image of the Day", about: "One picture of space or Earth each day", feed: "https://www.nasa.gov/feeds/iotd-feed/" },
];

/** The website's guide for newcomers, which the welcome links to. */
export const GUIDE_URL = "https://nineturtles.app/new-to-feeds/";

export type StartResult = { added: Feed[]; failed: Starter[] };

/**
 * Adds the chosen starters one after another, through the same path as
 * pasting an address, telling `progress` how many are done. One already
 * followed is skipped quietly; anything else that isn't a feed has failed.
 */
export async function addStarters(
  chosen: readonly Starter[],
  progress: (done: number) => void = () => {},
  add: typeof addFeed = addFeed,
): Promise<StartResult> {
  const added: Feed[] = [];
  const failed: Starter[] = [];
  for (const [index, starter] of chosen.entries()) {
    progress(index);
    const result = await add(starter.feed);
    if (result.kind === "added") added.push(result.feed);
    else if (result.kind !== "already") failed.push(starter);
  }
  progress(chosen.length);
  return { added, failed };
}

/** What the welcome says when none of the chosen starters could be added. */
export function startProblem(failed: readonly Starter[]): string {
  const [only] = failed;
  return failed.length === 1 && only
    ? `${only.name} couldn't be added just now. Try again later, or choose another.`
    : "Those feeds couldn't be added just now. Try again later.";
}

/** The note the list shows on arriving, when some starters were added and some weren't. */
export function partlyAdded(failed: readonly Starter[]): string {
  const names = failed.map((starter) => starter.name);
  const list = names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `Couldn't add ${list}. Try again later from Add feed.`;
}
