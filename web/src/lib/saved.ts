// Saved searches (SPEC section 14): a search the reader named, listed in the
// sidebar under "Saved searches" and run again when opened. What it searches
// is the search field's `Query`, kept by the server as it's sent
// (server/src/saved_searches.rs). This file only talks to the server and
// decides; the sidebar and the sheet show it.
import type { Library } from "./shapes";
import { chipsFor, isDate, type Query, type Scope } from "./search";
import { api } from "./updates.svelte";
import { isRecord, sendChange } from "./http";

export type SavedSearch = { id: number; name: string; query: Query };

/** Why a saved search wasn't saved, changed or deleted. */
export type SavedRefusal = "no-name" | "already" | "too-large" | "gone" | "trouble";

/** Every saved search, alphabetically, as the server lists them. */
export async function listSaved(): Promise<SavedSearch[]> {
  const response = await api("/api/saved-searches", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const body: unknown = await response.json();
  const searches = isRecord(body) && Array.isArray(body.searches) ? body.searches : [];
  return searches.filter(isRecord).map(toSaved);
}

/** Saves a search under a name; answers it, or why not. */
export async function saveSearch(name: string, query: Query): Promise<SavedSearch | SavedRefusal> {
  const { refusal, answer } = await send("/api/saved-searches", { name, query });
  if (refusal) return refusal;
  return isRecord(answer?.search) ? toSaved(answer.search) : "trouble";
}

/** A new name, and what it searches, saved together. */
export async function changeSaved(id: number, name: string, query: Query): Promise<SavedRefusal | undefined> {
  return (await send(`/api/saved-searches/${id}`, { name, query })).refusal;
}

export async function deleteSaved(id: number): Promise<SavedRefusal | undefined> {
  return (await send(`/api/saved-searches/${id}/delete`, {})).refusal;
}

/** What the sheet says when a saved search wasn't saved. */
export function refusedSaving(refusal: SavedRefusal): string {
  switch (refusal) {
    case "no-name":
      return "Give the search a name.";
    case "already":
      return "There's already a saved search with that name.";
    case "too-large":
      return "That search is too long to save. Try fewer words.";
    case "gone":
      return "This saved search isn't here any more.";
    case "trouble":
      return "That couldn't be saved. Try again in a moment.";
  }
}

/** Do two searches look for the same thing? */
export function sameQuery(one: Query, other: Query): boolean {
  return JSON.stringify(toQuery(one)) === JSON.stringify(toQuery(other));
}

/** A name to start from: the words searched for, else what the chips say. */
export function suggestedName(query: Query, library: Library): string {
  const words = query.words.replace(/"/g, "").replace(/\s+/g, " ").trim();
  if (words) return words.slice(0, 200);
  return chipsFor(query, library)
    .map((chip) => chip.label.replace(/^in: /, "In "))
    .join(", ")
    .slice(0, 200);
}

/** What a saved search looks for, in words, for the sheet: "climate · In Tech · Unread". */
export function describe(query: Query, library: Library): string {
  const words = query.words.trim();
  const chips = chipsFor(query, library).map((chip) => chip.label.replace(/^in: /, "In "));
  return [words, ...chips].filter(Boolean).join(" · ") || "Everything";
}

/**
 * A query as the server gave it back, made safe to use: anything missing or
 * not understood becomes "not filtered", never an error.
 */
export function toQuery(value: unknown): Query {
  const query = isRecord(value) ? value : {};
  const text = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  const day = (key: string) => (isDate(text(key)) ? text(key) : "");
  return {
    words: text("words"),
    scope: toScope(query.scope),
    unread: query.unread === true,
    starred: query.starred === true,
    after: day("after"),
    before: day("before"),
  };
}

function toScope(value: unknown): Scope {
  if (!isRecord(value)) return { kind: "all" };
  const id = Number(value.id);
  // Number 0 is a feed, folder or collection that's gone (server/src/saved_searches.rs → `forget`): it finds nothing.
  if ((value.kind === "feed" || value.kind === "folder" || value.kind === "collection") && Number.isInteger(id) && id >= 0) return { kind: value.kind, id };
  if (value.kind === "view" && (value.view === "unread" || value.view === "starred")) return { kind: "view", view: value.view };
  return { kind: "all" };
}

function toSaved(search: Record<string, unknown>): SavedSearch {
  return { id: Number(search.id), name: String(search.name ?? ""), query: toQuery(search.query) };
}

function send(path: string, body: unknown): Promise<{ refusal?: SavedRefusal; answer?: Record<string, unknown> }> {
  return sendChange(path, body, ["no-name", "already", "too-large"]);
}
