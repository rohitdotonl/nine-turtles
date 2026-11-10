// Search (SPEC section 14): what the reader is searching for, the chips that
// show it, and which words of a title to show in bold. This file only decides;
// the search field (SearchBar.svelte) shows it.
import type { Library } from "./shapes";
import type { Route } from "./router";

/** Where to search: everywhere, one of the views, one feed or one folder. */
export type Scope = { kind: "all" } | { kind: "view"; view: "unread" | "starred" | "notes" } | { kind: "feed"; id: number } | { kind: "folder"; id: number };

/**
 * Everything searched for: `words` is what's typed outside the chip, then
 * where (`scope`). Nothing else (decision 0241): a search from Starred finds
 * only starred ones.
 */
export type Query = {
  words: string;
  scope: Scope;
};

/** The chip in the field, in plain words ("in: Tech"). */
export type Chip = { key: "scope"; label: string };

/** A search starts out limited to where you are (SPEC.md section 14). */
export function scopeFor(route: Route): Scope {
  if (route.kind === "feed") return { kind: "feed", id: route.id };
  if (route.kind === "folder") return { kind: "folder", id: route.id };
  if (route.kind === "view" && route.view !== "all") return { kind: "view", view: route.view };
  return { kind: "all" };
}

export function emptyQuery(route: Route): Query {
  return { words: "", scope: scopeFor(route) };
}

/** Is there anything to search for? The scope alone isn't a search. */
export function isSearching(query: Query): boolean {
  return searchParams(query).q !== undefined;
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

/** The chip inside the field, if the search is limited to one place, so the field shows exactly what's searched. */
export function chipsFor(query: Query, library: Library): Chip[] {
  return query.scope.kind === "all" ? [] : [{ key: "scope", label: `in: ${scopeName(query.scope, library)}` }];
}

/** The query without its chip: a search that covers everything. */
export function withoutChip(query: Query): Query {
  return { ...query, scope: { kind: "all" } };
}

/** Letters compared without capitals, Latin accents, or Arabic and Hebrew vowel marks ("Café" is "cafe"; hamza and madda stay); other scripts as written. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064b-\u0652\u0656-\u065f\u0670\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7]/g, "")
    .normalize("NFC")
    .toLocaleLowerCase();
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
  if (scope.kind === "view" && scope.view === "starred") params.starred = "true";
  return params;
}

// A Chinese character or kana: in Chinese and Japanese, written without
// spaces, each is a word of its own, as the server's search splits them
// (the same ranges as `is_ideograph` in server/src/search/words.rs, decision 0228).
const IDEOGRAPH = "\\u3040-\\u309f\\u30a1-\\u30fa\\u30fc-\\u30ff\\u31f0-\\u31ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff66-\\uff9f\\u{20000}-\\u{3134f}";
const PIECES = new RegExp(`[${IDEOGRAPH}]|(?:(?![${IDEOGRAPH}])[\\p{L}\\p{M}\\p{N}])+|[^\\p{L}\\p{M}\\p{N}]+`, "gu");
const RUN = new RegExp(`[${IDEOGRAPH}]+|(?:(?![${IDEOGRAPH}])[\\p{L}\\p{M}\\p{N}])+`, "gu");
const isIdeograph = (piece: string) => new RegExp(`^[${IDEOGRAPH}]$`, "u").test(piece);

/** The searched words, for bold: quoted parts as their words, a run of Chinese characters or kana as one. */
export function searchedTerms(words: string): string[] {
  return words
    .replace(/"/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => word.match(RUN) ?? [])
    .map(fold);
}

/**
 * A title in pieces, each bold or not: a word is bold when it starts with a
 * searched word, as the search itself matches ("read" finds "reading"); a
 * searched run of Chinese characters or kana is bold where they stand together.
 */
export function boldParts(title: string, terms: string[]): { text: string; bold: boolean }[] {
  if (terms.length === 0) return [{ text: title, bold: false }];
  const pieces = [...title.matchAll(PIECES)].map(([piece]) => piece);
  const bold = pieces.map(() => false);
  pieces.forEach((piece, at) => {
    for (const term of terms) {
      const characters = [...term];
      if (isIdeograph(characters[0] ?? "")) {
        if (characters.every((character, i) => pieces[at + i] === character)) bold.fill(true, at, at + characters.length);
      } else if (/[\p{L}\p{M}\p{N}]/u.test(piece) && fold(piece).startsWith(term)) {
        bold[at] = true;
      }
    }
  });
  const parts: { text: string; bold: boolean }[] = [];
  pieces.forEach((piece, at) => {
    const last = parts[parts.length - 1];
    if (last && last.bold === bold[at]) last.text += piece;
    else parts.push({ text: piece, bold: bold[at] ?? false });
  });
  return parts;
}
