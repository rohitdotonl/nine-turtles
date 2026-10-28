// Collections (SPEC section 34, decision 0108): the reader's own named
// shelves for articles, listed in the sidebar under Saved searches. This file
// only talks to the server (server/src/collections.rs) and decides; the
// sidebar, the sheets and the list show it.
import { keepCollections, keptCollections } from "./offline";
import { api } from "./updates.svelte";
import { isRecord, sendChange } from "./http";

export type Collection = { id: number; name: string };

/** Why a collection wasn't made, renamed, deleted or saved for an article. */
export type CollectionRefusal = "no-name" | "already" | "gone" | "trouble";

/**
 * The reader's collections, A to Z. Without a connection, the ones this
 * device last kept for reading offline (they go when it signs out), so the
 * sidebar still lists them, each saying it needs a connection when opened;
 * with none kept, it fails.
 */
export async function listCollections(): Promise<Collection[]> {
  let response: Response;
  try {
    response = await api("/api/collections", { cache: "no-store" });
  } catch (problem) {
    const kept = await keptCollections();
    if (Array.isArray(kept)) return toCollections(kept);
    throw problem;
  }
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  const collections = toCollections(isRecord(body) ? body.collections : undefined);
  keepCollections(collections);
  return collections;
}

/** Collections as the server (or this device) gave them, made safe to use. */
export function toCollections(value: unknown): Collection[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((each) => ({ id: Number(each.id), name: String(each.name ?? "") }))
    .filter((each) => Number.isInteger(each.id) && each.id > 0 && each.name !== "");
}

/** A to Z, whatever the capitals, as the server lists them. */
export function byName(one: Collection, other: Collection): number {
  return one.name.localeCompare(other.name, undefined, { sensitivity: "base" }) || one.id - other.id;
}

/**
 * Makes a collection, with these articles on it already and these saved
 * searches limited to it again (Undo after deleting one); answers it, or why not.
 */
export async function makeCollection(name: string, held: Held = { articles: [], searches: [] }): Promise<Collection | CollectionRefusal> {
  const { refusal, answer } = await send("/api/collections", { name, articles: held.articles, searches: held.searches });
  if (refusal) return refusal;
  const [made] = toCollections([answer?.collection]);
  return made ?? "trouble";
}

export async function renameCollection(id: number, name: string): Promise<CollectionRefusal | undefined> {
  return (await send(`/api/collections/${id}`, { name })).refusal;
}

/** What a deleted collection held: its articles, and the saved searches limited to it. */
export type Held = { articles: number[]; searches: number[] };

/** Deletes a collection (never an article); answers what it held, for Undo, or why not. */
export async function deleteCollection(id: number): Promise<Held | CollectionRefusal> {
  const { refusal, answer } = await send(`/api/collections/${id}/delete`, {});
  if (refusal) return refusal;
  const numbers = (value: unknown) => (Array.isArray(value) ? value.map(Number).filter(Number.isInteger) : []);
  return { articles: numbers(answer?.articles), searches: numbers(answer?.searches) };
}

/** The collections an article is on, by number; undefined if that can't be said just now. */
export async function collectionsOf(article: number): Promise<number[] | undefined> {
  try {
    const response = await api(`/api/articles/${article}/collections`, { cache: "no-store" });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    return isRecord(body) && Array.isArray(body.collections) ? body.collections.map(Number).filter(Number.isInteger) : undefined;
  } catch {
    return undefined;
  }
}

/** Puts an article on exactly these collections: it leaves any not named. */
export async function saveCollectionsOf(article: number, collections: number[]): Promise<CollectionRefusal | undefined> {
  return (await send(`/api/articles/${article}/collections`, { collections })).refusal;
}

/** What Save in "Add to collection" changed for one article: the collections it was on, and is on now. */
export type CollectionChange = { article: number; before: number[]; after: number[] };

/**
 * The collections a Save took the article off (A to Z), and what the line
 * says about it, so Undo can put it back; undefined when it took it off none.
 */
export function takenOff(change: CollectionChange, collections: Collection[]): { ids: number[]; message: string } | undefined {
  const off = collections.filter((each) => change.before.includes(each.id) && !change.after.includes(each.id)).sort(byName);
  if (off.length === 0) return undefined;
  const where = off.length === 1 && off[0] ? off[0].name : `${off.length} collections`;
  return { ids: off.map((each) => each.id), message: `Took the article off ${where}` };
}

/** Undo after "Took the article off …": puts it back on those, keeping whatever else it's on now. */
export async function putBack(article: number, ids: number[]): Promise<string | undefined> {
  const now = await collectionsOf(article);
  if (!now) return refusedCollection("trouble");
  const refusal = await saveCollectionsOf(article, [...new Set([...now, ...ids])]);
  return refusal ? refusedCollection(refusal) : undefined;
}

/** What a sheet says when a collection wasn't saved. */
export function refusedCollection(refusal: CollectionRefusal): string {
  switch (refusal) {
    case "no-name":
      return "Give the collection a name.";
    case "already":
      return "There's already a collection with that name.";
    case "gone":
      return "This isn't here any more. It may have been deleted.";
    case "trouble":
      return "That couldn't be saved. Try again in a moment.";
  }
}

function send(path: string, body: unknown): Promise<{ refusal?: CollectionRefusal; answer?: Record<string, unknown> }> {
  return sendChange(path, body, ["no-name", "already"]);
}
