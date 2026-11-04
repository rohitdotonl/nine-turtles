// People (SPEC section 36, decision 0146): a person is one human with one or
// more places on the web (a blog, a channel, a newsletter), and each person is
// one row in the sidebar and one page. A place the reader hasn't joined to
// another is a person with one place, and looks as it always did. The server
// calls them "writers" (the readers are its "people"); the screen never says
// "feed" about them.
//
// A person's row stands for all their places: it links to their first place
// (`/people/3`), whose list the server widens to all of them, and its count is
// their places' counts added up.

import { change, plainSourceName, refused, type Notice } from "./feeds";
import type { Article, Feed, Person, PlaceKind } from "./shapes";

export const PLACE_NAMES: Record<PlaceKind, string> = { blog: "Blog", video: "Video", newsletter: "Newsletter", podcast: "Podcast" };

/** A place before a join or a separation, as the server answers it, for Undo. */
type Before = { feed: number; writer: number | null; name: string | null; folders: number[]; write_to: string | null };

/** A place's person, if the reader joined it to others. */
export function personOf(feed: Feed, people: Person[]): Person | undefined {
  return feed.person == null ? undefined : people.find((person) => person.id === feed.person);
}

/** Every place of the person `feed` belongs to, oldest followed first: just `feed` for a place on its own. */
export function placesOf(feed: Feed, feeds: Feed[]): Feed[] {
  if (feed.person == null) return [feed];
  return feeds.filter((each) => each.person === feed.person).sort((one, other) => (one.addedAt ?? 0) - (other.addedAt ?? 0) || one.id - other.id);
}

/**
 * The sidebar's rows, A to Z: one per person. A person's row takes their
 * name, their first place's number (the place their row opens), their places'
 * counts added up and every folder any place is in; a place on its own is its
 * own row, as before.
 */
export function rowsOf(feeds: Feed[], people: Person[]): Feed[] {
  const rows: Feed[] = [];
  const done = new Set<number>();
  for (const feed of feeds) {
    const person = personOf(feed, people);
    if (!person) {
      rows.push(feed);
      continue;
    }
    if (done.has(person.id)) continue;
    done.add(person.id);
    const places = placesOf(feed, feeds);
    const first = places[0]!;
    rows.push({
      ...first,
      title: person.name,
      unread: places.reduce((sum, place) => sum + place.unread, 0),
      folders: [...new Set(places.flatMap((place) => place.folders))],
      places: places.map((place) => place.id),
    });
  }
  return rows.sort((one, other) => one.title.localeCompare(other.title, undefined, { sensitivity: "base" }) || one.id - other.id);
}

/** The row that stands for the place numbered `id`: its person's, or its own. */
export function rowFor(id: number, rows: Feed[]): Feed | undefined {
  return rows.find((row) => row.id === id || row.places?.includes(id));
}

/**
 * Tells, each time it's asked, whether the person on screen (`id`) gained or lost a place
 * since it was last asked: their list then refreshes in place, keeping its line and Undo.
 */
export function placesWatch(): (id: number | undefined, count: number) => boolean {
  let seen: [number | undefined, number] = [undefined, 0];
  return (id, count) => {
    const changed = id === seen[0] && count !== seen[1];
    seen = [id, count];
    return changed;
  };
}

/** The website part of a place's address, without "www.", for its line on the person's page. */
export function siteName(address: string | null): string | undefined {
  if (!address) return undefined;
  try {
    const host = new URL(address).hostname;
    return host.replace(/^www\./, "") || undefined;
  } catch {
    return undefined;
  }
}

/** "since March 2026" (or "since this month"): when the reader followed the person's first place. */
export function followingSince(places: Feed[], now = new Date()): string | undefined {
  const first = Math.min(...places.map((place) => place.addedAt ?? Infinity));
  if (!Number.isFinite(first)) return undefined;
  const date = new Date(first * 1000);
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) return "since this month";
  return `since ${date.toLocaleDateString("en-GB", { month: "long" })} ${date.getFullYear()}`;
}

/** How a place is named on its person's page: a blog by its website, a channel or newsletter by its own name. */
export function placeShownAs(place: Feed): string {
  return (place.place === "blog" || place.place === undefined ? siteName(place.siteUrl) : undefined) ?? plainSourceName(place.title);
}

/**
 * What Write back calls someone (owner's plan, step 2): a person by their first name ("Tomas" for
 * Tomas Berg), when their name is their own rather than a blog's title; anyone else by their whole name.
 */
export function firstNameOf(name: string, places: Feed[]): string {
  const words = name.trim().split(/\s+/);
  const theirOwn = places.every((place) => place.kind !== "publication" && place.siteTitle?.toLowerCase() !== name.trim().toLowerCase());
  const aName = words.length >= 2 && words.length <= 4 && words.every((word) => /^\p{Lu}[\p{L}'’-]*$/u.test(word));
  return theirOwn && aName && words[0] ? words[0] : name;
}

/**
 * How a list's rows credit each article: `false` by its maker's name (a person's or a place's);
 * `true` not at all (one place's own list, which says who in its title); or, in the list of a
 * person with several places, by the place each came from ("Blog", "Video").
 */
export type OneSource = boolean | ((article: Article) => string);

export function sourceOf(article: Article, one: OneSource | undefined): string {
  return typeof one === "function" ? one(article) : plainSourceName(article.feedTitle);
}

/** The labels in the list of a person with several places: what each article's place is. */
export function placeLabels(places: Feed[]): OneSource {
  if (places.length < 2) return true;
  return (article) => (article.episode ? "Podcast" : PLACE_NAMES[places.find((place) => place.id === article.feedId)?.place ?? "blog"]);
}

/** Joins places into one person ("+ Add a source"), in exactly `folders` when the reader chose them. */
export async function join(feeds: number[], name?: string, folders?: number[]): Promise<{ refusal?: string; before: Before[] }> {
  const { refusal, answer } = await change("/api/writers/join", { feeds, ...(name === undefined ? {} : { name }), ...(folders === undefined ? {} : { folders }) });
  if (refusal) return { refusal: refused(refusal, "feed"), before: [] };
  return { before: befores(answer?.before) };
}

/** "Unsubscribe from Alpha…": every source of theirs at once. Answers the places left, for Undo. */
export async function unsubscribeAll(feed: number, removeKept = false): Promise<{ refusal?: string; left: number[] }> {
  const { refusal, answer } = await change("/api/writers/unsubscribe", { feed, ...(removeKept ? { remove_kept: true } : {}) });
  if (refusal) return { refusal: refused(refusal, "feed"), left: [] };
  return { left: Array.isArray(answer?.feeds) ? answer.feeds.map(Number) : [] };
}

/** Undo for a join or a separation. */
export async function putBack(before: Before[]): Promise<string | undefined> {
  const { refusal } = await change("/api/writers/put-back", { before });
  return refusal ? refused(refusal, "feed") : undefined;
}

/** "Take out of Alpha": one source leaves its person, and stands on its own. */
export async function separate(feed: number): Promise<{ refusal?: string; before: Before[] }> {
  const { refusal, answer } = await change("/api/writers/separate", { feed });
  if (refusal) return { refusal: refused(refusal, "feed"), before: [] };
  return { before: befores(answer?.before) };
}

/** "This is one person": a folder's places become one person, and the folder goes. */
export async function folderToPerson(folder: number): Promise<{ refusal?: string; before: Before[] }> {
  const { refusal, answer } = await change(`/api/folders/${folder}/person`, {});
  if (refusal) return { refusal: refused(refusal, "folder"), before: [] };
  return { before: befores(answer?.before) };
}

function befores(list: unknown): Before[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((each): each is Record<string, unknown> => typeof each === "object" && each !== null)
    .map((each) => ({
      feed: Number(each.feed),
      writer: typeof each.writer === "number" ? each.writer : null,
      name: typeof each.name === "string" ? each.name : null,
      folders: Array.isArray(each.folders) ? each.folders.map(Number) : [],
      write_to: typeof each.write_to === "string" ? each.write_to : null,
    }));
}

/** The line and Undo after joining places: "Alpha is one person now · Undo". */
export function joinedNotice(name: string, before: Before[], reload: () => Promise<void>): Notice {
  return {
    message: `${name} is one person now`,
    undo: async () => {
      const problem = await putBack(before);
      await reload();
      return problem;
    },
  };
}

