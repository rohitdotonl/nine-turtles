// Search (SPEC section 14): what the reader is searching for, the chips that
// show it, and which words of a title to show in bold. This file only decides;
// the search field (SearchBar.svelte) shows it.
import type { Library } from "./shapes";
import type { Route } from "./router";

/** Where to search: everywhere, one of the views, one feed or one folder. */
export type Scope = { kind: "all" } | { kind: "view"; view: "unread" | "starred" } | { kind: "feed"; id: number } | { kind: "folder"; id: number };

/**
 * Everything searched for. `words` is what's typed outside the chips; the
 * dates are `YYYY-MM-DD` or empty. Results are published strictly after
 * `after` and strictly before `before`.
 */
export type Query = {
  words: string;
  scope: Scope;
  unread: boolean;
  starred: boolean;
  /** Only articles the reader highlighted or wrote a note on (SPEC section 42). */
  noted?: boolean;
  after: string;
  before: string;
};

/** A chip in the field: `label` in plain words, as the Search options menu names the same choice ("Unread", "After 1 Oct 2026"). */
export type Chip = { key: "scope" | "unread" | "starred" | "noted" | "after" | "before"; label: string };

const CHIP_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** A `YYYY-MM-DD` day in words, "1 Oct 2026", or the text as it is if it isn't one. */
export function dayInWords(date: string): string {
  if (!isDate(date)) return date;
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return CHIP_DAY.format(new Date(year, month - 1, day));
}

/** A search starts out limited to where you are (SPEC.md section 14). */
export function scopeFor(route: Route): Scope {
  if (route.kind === "feed") return { kind: "feed", id: route.id };
  if (route.kind === "folder") return { kind: "folder", id: route.id };
  if (route.kind === "view" && (route.view === "unread" || route.view === "starred")) return { kind: "view", view: route.view };
  return { kind: "all" };
}

export function emptyQuery(route: Route): Query {
  return { words: "", scope: scopeFor(route), unread: false, starred: false, after: "", before: "" };
}

/** Is there anything to search for? The scope alone isn't a search. */
export function isSearching(query: Query): boolean {
  return searchParams(query).q !== undefined || query.unread || query.starred || query.noted === true || query.after !== "" || query.before !== "";
}

export function scopeName(scope: Scope, library: Library): string {
  switch (scope.kind) {
    case "all":
      return "All feeds";
    case "view":
      return scope.view === "unread" ? "Unread" : "Starred";
    case "feed":
      return library.feeds.find((feed) => feed.id === scope.id)?.title ?? "A feed";
    case "folder":
      return library.folders.find((folder) => folder.id === scope.id)?.name ?? "A folder";
  }
}

/** The list's title while it shows search results (SPEC section 14): "Results in All", or "Results in Tech". */
export function resultsTitle(scope: Scope, library: Library): string {
  return `Results in ${scope.kind === "all" ? "All" : scopeName(scope, library)}`;
}

/** The chips inside the field, in a fixed order, so the field shows exactly what's searched. */
export function chipsFor(query: Query, library: Library): Chip[] {
  const chips: Chip[] = [];
  if (query.scope.kind !== "all") chips.push({ key: "scope", label: `in: ${scopeName(query.scope, library)}` });
  if (query.unread) chips.push({ key: "unread", label: "Unread" });
  if (query.starred) chips.push({ key: "starred", label: "Starred" });
  if (query.noted) chips.push({ key: "noted", label: "With notes" });
  if (query.after) chips.push({ key: "after", label: `After ${dayInWords(query.after)}` });
  if (query.before) chips.push({ key: "before", label: `Before ${dayInWords(query.before)}` });
  return chips;
}

/** The query without one chip. Without its scope chip, a search covers everything. */
export function withoutChip(query: Query, key: Chip["key"]): Query {
  switch (key) {
    case "scope":
      return { ...query, scope: { kind: "all" } };
    case "unread":
    case "starred":
    case "noted":
      return { ...query, [key]: false };
    case "after":
    case "before":
      return { ...query, [key]: "" };
  }
}

/** Letters compared without capitals or Latin accents ("Café" is "cafe"); other scripts as written. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC").toLocaleLowerCase();
}

/** A real day written `YYYY-MM-DD`. */
export function isDate(text: string): boolean {
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** The start of a `YYYY-MM-DD` day (plus `later` days) on this device's clock, in seconds since 1970. */
function startOf(date: string, later = 0): number {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  return Math.floor(new Date(year, month - 1, day + later).getTime() / 1000);
}

/** What the server is asked (server/src/search.rs → `Search`). */
export function searchParams(query: Query): Record<string, string> {
  const params: Record<string, string> = {};
  const words = query.words.replace(/\s+/g, " ").trim();
  if (words) params.q = words;
  const scope = query.scope;
  if (scope.kind === "feed") params.feed = String(scope.id);
  if (scope.kind === "folder") params.folder = String(scope.id);
  if (query.unread || (scope.kind === "view" && scope.view === "unread")) params.unread = "true";
  if (query.starred || (scope.kind === "view" && scope.view === "starred")) params.starred = "true";
  if (query.noted) params.notes = "true";
  if (isDate(query.after)) params.since = String(startOf(query.after, 1));
  if (isDate(query.before)) params.until = String(startOf(query.before));
  return params;
}

/** The searched words, for bold: quoted parts as their words. */
export function searchedTerms(words: string): string[] {
  return words
    .replace(/"/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => word.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [])
    .map(fold);
}

/**
 * A title in pieces, each bold or not: a word is bold when it starts with a
 * searched word, as the search itself matches ("read" finds "reading").
 */
export function boldParts(title: string, terms: string[]): { text: string; bold: boolean }[] {
  if (terms.length === 0) return [{ text: title, bold: false }];
  const parts: { text: string; bold: boolean }[] = [];
  for (const [piece] of title.matchAll(/[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+/gu)) {
    const isWord = /[\p{L}\p{M}\p{N}]/u.test(piece);
    const bold = isWord && terms.some((term) => fold(piece).startsWith(term));
    const last = parts[parts.length - 1];
    if (last && last.bold === bold) last.text += piece;
    else parts.push({ text: piece, bold });
  }
  return parts;
}
