// Search (SPEC section 14): what the reader is searching for, the chips that
// show it, and which words of a title to show in bold. This file only decides;
// the search field (SearchBar.svelte) shows it.
import type { Library } from "./shapes";
import type { Route } from "./router";

/** Where to search: everywhere, one of the views, one feed or one folder. */
export type Scope = { kind: "all" } | { kind: "view"; view: "unread" | "starred" | "notes" } | { kind: "feed"; id: number } | { kind: "folder"; id: number };

/**
 * Everything searched for: `words` is what's typed outside the chips, then
 * where (`scope`) and whether only starred ones (decision 0189: nothing else).
 */
export type Query = {
  words: string;
  scope: Scope;
  starred: boolean;
};

/** A chip in the field: `label` in plain words, as the Search options menu names the same choice ("in: Tech", "Starred"). */
export type Chip = { key: "scope" | "starred"; label: string };

/** A search starts out limited to where you are (SPEC.md section 14). */
export function scopeFor(route: Route): Scope {
  if (route.kind === "feed") return { kind: "feed", id: route.id };
  if (route.kind === "folder") return { kind: "folder", id: route.id };
  if (route.kind === "view" && route.view !== "all") return { kind: "view", view: route.view };
  return { kind: "all" };
}

export function emptyQuery(route: Route): Query {
  return { words: "", scope: scopeFor(route), starred: false };
}

/** Is there anything to search for? The scope alone isn't a search. */
export function isSearching(query: Query): boolean {
  return searchParams(query).q !== undefined || query.starred;
}

export function scopeName(scope: Scope, library: Library): string {
  switch (scope.kind) {
    case "all":
      return "All articles";
    case "view":
      return { unread: "Unread", starred: "Starred", notes: "Notes" }[scope.view];
    case "feed":
      return library.feeds.find((feed) => feed.id === scope.id)?.title ?? "A feed";
    case "folder":
      return library.folders.find((folder) => folder.id === scope.id)?.name ?? "A folder";
  }
}

/** The list's title while it shows search results (SPEC section 14): "Results in All articles", or "Results in Tech". */
export function resultsTitle(scope: Scope, library: Library): string {
  return `Results in ${scopeName(scope, library)}`;
}

/** The chips inside the field, in a fixed order, so the field shows exactly what's searched. */
export function chipsFor(query: Query, library: Library): Chip[] {
  const chips: Chip[] = [];
  if (query.scope.kind !== "all") chips.push({ key: "scope", label: `in: ${scopeName(query.scope, library)}` });
  if (query.starred) chips.push({ key: "starred", label: "Starred" });
  return chips;
}

/** The query without one chip. Without its scope chip, a search covers everything. */
export function withoutChip(query: Query, key: Chip["key"]): Query {
  return key === "scope" ? { ...query, scope: { kind: "all" } } : { ...query, starred: false };
}

/** Letters compared without capitals or Latin accents ("Café" is "cafe"); other scripts as written. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC").toLocaleLowerCase();
}

/** What the server is asked (server/src/search.rs → `Search`). */
export function searchParams(query: Query): Record<string, string> {
  const params: Record<string, string> = {};
  const words = query.words.replace(/\s+/g, " ").trim();
  if (words) params.q = words;
  const scope = query.scope;
  if (scope.kind === "feed") params.feed = String(scope.id);
  if (scope.kind === "folder") params.folder = String(scope.id);
  if (scope.kind === "view" && scope.view === "unread") params.unread = "true";
  if (scope.kind === "view" && scope.view === "notes") params.notes = "true";
  if (query.starred || (scope.kind === "view" && scope.view === "starred")) params.starred = "true";
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
