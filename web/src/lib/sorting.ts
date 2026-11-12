// Person or publication, and why (SPEC section 36, decision 0264): nine
// turtles sorts each place it can from the feed alone and says why; where it
// can't tell, the place could be either, kept with the publications until
// the reader settles it, on Everyone you follow, their page, or at the end
// of one of their articles.

import { sendChange } from "./http";
import { saved } from "./saving";
import type { WhoKind } from "./shapes";

/** Why a place is filed as it is: nine turtles' reasons, or the reader's choice. */
export type Why =
  | "one-name"
  | "own-site"
  | "several-names"
  | "site-name"
  | "folder"
  | "unsure-no-names"
  | "unsure-channel"
  | "reader";

const WHYS: Why[] = ["one-name", "own-site", "several-names", "site-name", "folder", "unsure-no-names", "unsure-channel", "reader"];

export function toWhy(value: unknown): Why | null {
  return WHYS.find((why) => why === value) ?? null;
}

/** nine turtles couldn't tell: it could be either. */
export function isOpen(why: Why | null | undefined): boolean {
  return why === "unsure-no-names" || why === "unsure-channel";
}

/** Each of nine turtles' reasons, said after "nine turtles chose this: ". */
const REASONS: Partial<Record<Why, string>> = {
  "one-name": "one name signs every article",
  "own-site": "the site is someone's own",
  "several-names": "several names sign its articles",
  "site-name": "it writes under its site's own name",
};

/** Their page's line under "This is", or none (sorted before nine turtles said why). */
export function whyLine(why: Why | null | undefined): string | undefined {
  if (!why) return undefined;
  if (why === "reader") return "Your choice.";
  if (why === "folder") return "nine turtles chose this from the name of the folder it came in.";
  if (why === "unsure-no-names") return "nine turtles couldn't tell: no name signs their articles. Kept as a publication until you choose.";
  if (why === "unsure-channel") return "nine turtles can't tell a person's channel from a company's. Kept as a publication until you choose.";
  return `nine turtles chose this: ${REASONS[why]}.`;
}

const LATER = "You can change this later on their page.";

/** Add's help under "{name} is…": why the tile is chosen, or that none is. */
export function addedLine(why: Why | null | undefined): string {
  if (isOpen(why)) return `nine turtles couldn't tell from their feed. Left as it is, they're kept with Publications. ${LATER}`;
  if (why === "folder") return `nine turtles chose this from the name of the folder it came in. ${LATER}`;
  const reason = why ? REASONS[why] : undefined;
  return reason ? `nine turtles chose this: ${reason}. ${LATER}` : LATER;
}

/** One place settled, and why: left out, the reader chose it. */
export type Settling = { feed: number; kind: WhoKind; why?: Why };

/** Settles places at once, all or none: a tick, "The rest are publications", or Undo putting back what each was. */
export async function settle(feeds: Settling[]): Promise<"gone" | "trouble" | undefined> {
  await saved();
  return (await sendChange("/api/tidy/settle", { feeds }, [])).refusal;
}

/** The import's closing line's counts (decision 0264). */
export type Sorted = { people: number; publications: number; open: number };

export function toSorted(value: unknown): Sorted | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const count = (name: string) => (typeof record[name] === "number" ? (record[name] as number) : 0);
  const sorted = { people: count("people"), publications: count("publications"), open: count("open") };
  return sorted.people + sorted.publications + sorted.open > 0 ? sorted : undefined;
}

/** "Your list is in: 18 people and 4 publications. 8 could be either." Parts that are none are left out. */
export function sortedLine({ people, publications, open }: Sorted): string {
  const filed = [
    people > 0 ? `${people} ${people === 1 ? "person" : "people"}` : "",
    publications > 0 ? `${publications} ${publications === 1 ? "publication" : "publications"}` : "",
  ].filter(Boolean);
  const either = `${open} could be either.`;
  if (filed.length === 0) return `Your list is in: ${either}`;
  const said = `Your list is in: ${filed.join(" and ")}.`;
  return open > 0 ? `${said} ${either}` : said;
}

/** Ends the import's closing line for good. */
export async function closeSorted(): Promise<void> {
  await sendChange("/api/opml/note/close", {}, []);
}

/** The import's closing line, and its two ways out: Look them over, and ×. */
export type SortedLine = { counts: Sorted; onLookOver: () => void; onClose: () => void };
