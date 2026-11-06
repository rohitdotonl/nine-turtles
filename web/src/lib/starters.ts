/**
 * The "New to feeds?" starters (SPEC section 2, decision 0079): a short,
 * fixed list shown only in the first-visit welcome, the same for every
 * reader, so a newcomer can see how feeds work before choosing their own.
 * Nothing here is ranked or chosen for anyone, and none is added unless the
 * reader ticks it. Each is a person writing their own blog, so each is filed
 * as a person, someone you might write back to (decision 0163). Each address is the publisher's own feed, so adding one
 * never looks at a web page (decision 0016).
 */

import type { Feed } from "./shapes";
import { addFeed, editFeed } from "./feeds";

export type Starter = {
  name: string;
  /** One quiet line on what it publishes. */
  about: string;
  /** The publisher's own feed address. */
  feed: string;
  /** Their website, which the name links to, in a tab of its own. */
  site: string;
};

export const STARTERS: readonly Starter[] = [
  { name: "James", about: "Coffee, coffee interviews and the web", feed: "https://jamesg.blog/feeds/posts.xml", site: "https://jamesg.blog/" },
  { name: "Derek Sivers", about: "Philosophy, culture and how to live", feed: "https://sive.rs/feed.xml", site: "https://sive.rs/" },
  { name: "Herman Martinus", about: "Short essays from the maker of Bear Blog", feed: "https://herman.bearblog.dev/feed/", site: "https://herman.bearblog.dev/" },
  { name: "Jeff Kaufman", about: "Parenting, contra dance, music and tech", feed: "https://www.jefftk.com/news.rss", site: "https://www.jefftk.com/" },
  { name: "Ava", about: "Tech, data protection, health and making", feed: "https://blog.avas.space/feed/", site: "https://blog.avas.space/" },
];

/** The website's guide for newcomers, which the welcome links to. */
export const GUIDE_URL = "https://nineturtles.app/new-to-feeds/";

export type StartResult = { added: Feed[]; failed: Starter[] };

/**
 * Adds the chosen starters one after another, through the same path as
 * pasting an address, telling `progress` how many are done, and files each
 * one added as a person rather than leaving it to the guess. One already
 * followed is skipped quietly; anything else that isn't a feed has failed.
 */
export async function addStarters(
  chosen: readonly Starter[],
  progress: (done: number) => void = () => {},
  add: typeof addFeed = addFeed,
  edit: typeof editFeed = editFeed,
): Promise<StartResult> {
  const added: Feed[] = [];
  const failed: Starter[] = [];
  for (const [index, starter] of chosen.entries()) {
    progress(index);
    const result = await add(starter.feed);
    if (result.kind === "added") {
      // Always said, never left to the guess, which can take a blog named after its writer for a publication.
      const refusal = await edit(result.feed.id, { kind: "person" });
      added.push(refusal ? result.feed : { ...result.feed, kind: "person" });
    } else if (result.kind !== "already") failed.push(starter);
  }
  progress(chosen.length);
  return { added, failed };
}

/** A site's address as the reader would type it: no https:// and no www. or slash at the ends. */
export function siteName(site: string): string {
  return site.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

const COUNTS = ["none", "one", "two", "three", "four", "five", "six"];

/** The main button: with nothing ticked it adds all of them; once any is ticked, only those. */
export function addLabel(ticked: number): string {
  return ticked === 0 ? `Add all ${COUNTS[STARTERS.length] ?? STARTERS.length}` : `Add ${ticked} chosen`;
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
  return `Couldn't add ${list}. Try again later from + Add.`;
}
