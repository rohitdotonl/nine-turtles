// Search (SPEC section 14): what the reader is searching for, the chips that
// show it, the filters they can type, the suggestions offered as they type,
// and which words of a title to show in bold. This file only decides; the
// search field (SearchBar.svelte) shows it.
import type { Feed, Folder, Library } from "./feeds";
import type { Route } from "./router";

/** Where to search: everywhere, one of the views, one feed or one folder. */
export type Scope =
  | { kind: "all" }
  | { kind: "view"; view: "unread" | "starred" }
  | { kind: "feed"; id: number }
  | { kind: "folder"; id: number };

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
  after: string;
  before: string;
};

/**
 * A chip in the field: `label` in plain words, as the Search options menu
 * names the same filter ("Unread", "After 1 Oct 2026"); `typed`, for a
 * filter, is how it's written in the field (`is:unread`), kept for its
 * tooltip and for screen readers (decision 0048).
 */
export type Chip = { key: "scope" | "unread" | "starred" | "after" | "before"; label: string; typed?: string };

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
  return searchParams(query).q !== undefined || query.unread || query.starred || query.after !== "" || query.before !== "";
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

/** The chips inside the field, in a fixed order, so the field shows exactly what's searched. */
export function chipsFor(query: Query, library: Library): Chip[] {
  const chips: Chip[] = [];
  if (query.scope.kind !== "all") chips.push({ key: "scope", label: `in: ${scopeName(query.scope, library)}` });
  if (query.unread) chips.push({ key: "unread", label: "Unread", typed: "is:unread" });
  if (query.starred) chips.push({ key: "starred", label: "Starred", typed: "is:starred" });
  if (query.after) chips.push({ key: "after", label: `After ${dayInWords(query.after)}`, typed: `after:${query.after}` });
  if (query.before) chips.push({ key: "before", label: `Before ${dayInWords(query.before)}`, typed: `before:${query.before}` });
  return chips;
}

/** The query without one chip. Without its scope chip, a search covers everything. */
export function withoutChip(query: Query, key: Chip["key"]): Query {
  switch (key) {
    case "scope":
      return { ...query, scope: { kind: "all" } };
    case "unread":
    case "starred":
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
  // A filter still being typed (or one that couldn't be applied) isn't searched as words.
  const words = withoutFilters(query.words);
  if (words) params.q = words;
  const scope = query.scope;
  if (scope.kind === "feed") params.feed = String(scope.id);
  if (scope.kind === "folder") params.folder = String(scope.id);
  if (query.unread || (scope.kind === "view" && scope.view === "unread")) params.unread = "true";
  if (query.starred || (scope.kind === "view" && scope.view === "starred")) params.starred = "true";
  if (isDate(query.after)) params.since = String(startOf(query.after, 1));
  if (isDate(query.before)) params.until = String(startOf(query.before));
  return params;
}

const KEYS = ["is", "feed", "folder", "after", "before"] as const;

/** A filter as typed: `key:value`, or `key:"a name with spaces"`, its closing quote perhaps not typed yet. */
const FILTER = /(?:^|\s)(?:is|feed|folder|after|before):(?:"[^"]*"?|\S*)/gi;

/** The words without any filter, whole or half typed. */
function withoutFilters(words: string): string {
  return words.replace(FILTER, " ").replace(/\s+/g, " ").trim();
}
type Key = (typeof KEYS)[number];

/** The best match for a typed name: the same name, else the only one starting with it, else the only one containing it. */
function byName<T>(items: T[], name: (item: T) => string, typed: string): T | undefined {
  const wanted = fold(typed.replace(/^"|"$/g, "").trim());
  if (!wanted) return undefined;
  const exact = items.filter((item) => fold(name(item)) === wanted);
  if (exact.length > 0) return exact[0];
  const starts = items.filter((item) => fold(name(item)).startsWith(wanted));
  if (starts.length === 1) return starts[0];
  const contains = items.filter((item) => fold(name(item)).includes(wanted));
  return contains.length === 1 ? contains[0] : undefined;
}

/** Applies one typed filter, or says plainly why it can't. */
function apply(query: Query, key: Key, value: string, library: Library): Query | string {
  const plain = value.replace(/^"|"$/g, "");
  switch (key) {
    case "is":
      if (plain === "unread") return { ...query, unread: true };
      if (plain === "starred") return { ...query, starred: true };
      return "is: can be is:unread or is:starred.";
    case "feed": {
      const feed = byName<Feed>(library.feeds, (each) => each.title, plain);
      return feed ? { ...query, scope: { kind: "feed", id: feed.id } } : `No feed matches “${plain}”.`;
    }
    case "folder": {
      const folder = byName<Folder>(library.folders, (each) => each.name, plain);
      return folder ? { ...query, scope: { kind: "folder", id: folder.id } } : `No folder matches “${plain}”.`;
    }
    case "after":
    case "before":
      return isDate(plain) ? { ...query, [key]: plain } : `Write the date as YYYY-MM-DD, like ${key}:2026-10-23.`;
  }
}

/**
 * Turns the filters typed in `words` into chips. While typing, only a
 * filter followed by a space is taken (`finished` false), so `feed:gar`
 * isn't read before `feed:garden` is done; on Enter, all of them are. A
 * filter that can't be applied stays in the words, with a plain `problem`.
 */
export function takeFilters(
  query: Query,
  library: Library,
  finished: boolean,
): { query: Query; problem?: string } {
  let next: Query = { ...query, words: "" };
  let problem: string | undefined;
  const kept: string[] = [];
  const pattern = /(\S*"[^"]*"\S*|\S+)(\s*)/g;
  for (const [, token = "", space = ""] of query.words.matchAll(pattern)) {
    const filter = token.match(/^(is|feed|folder|after|before):(.+)$/i);
    // A name whose closing quote isn't typed yet isn't finished, whatever follows.
    const open = (token.match(/"/g) ?? []).length % 2 === 1;
    if (filter && (finished || (space !== "" && !open))) {
      const result = apply(next, (filter[1] ?? "").toLowerCase() as Key, filter[2] ?? "", library);
      if (typeof result === "string") {
        problem = result;
        kept.push(token + space);
      } else {
        next = result;
      }
    } else {
      kept.push(token + space);
    }
  }
  next.words = finished ? kept.join("").trim() : kept.join("");
  return { query: next, problem };
}

/** One suggestion under the field: a filter's start to type on, or a whole filter. */
export type Suggestion = { label: string; text: string } | { label: string; query: (query: Query) => Query };

/** The word being typed: whatever follows the last space, or a filter whose quoted name is still open. */
function lastWord(words: string): string {
  const quoted = words.match(/(?:^|\s)((?:is|feed|folder|after|before):"[^"]*)$/i);
  if (quoted?.[1]) return quoted[1];
  if (/\s$/.test(words)) return "";
  return words.split(/\s+/).pop() ?? "";
}

/** Suggestions for the word being typed, at most six (SPEC section 14: "suggested as you type"). */
export function suggestions(words: string, library: Library): Suggestion[] {
  const typed = lastWord(words);
  const filter = typed.match(/^(is|feed|folder|after|before):(.*)$/i);
  if (filter) {
    const key = (filter[1] ?? "").toLowerCase() as Key;
    const value = fold((filter[2] ?? "").replace(/^"/, ""));
    switch (key) {
      case "is":
        return (["unread", "starred"] as const)
          .filter((what) => what.startsWith(value))
          .map((what) => ({ label: `is:${what}`, query: (query: Query) => ({ ...query, [what]: true }) }));
      case "feed":
        return library.feeds
          .filter((feed) => fold(feed.title).includes(value))
          .slice(0, 6)
          .map((feed) => ({
            label: `feed:${feed.title}`,
            query: (query: Query) => ({ ...query, scope: { kind: "feed", id: feed.id } }),
          }));
      case "folder":
        return library.folders
          .filter((folder) => fold(folder.name).includes(value))
          .slice(0, 6)
          .map((folder) => ({
            label: `folder:${folder.name}`,
            query: (query: Query) => ({ ...query, scope: { kind: "folder", id: folder.id } }),
          }));
      case "after":
      case "before":
        return [];
    }
  }
  const start = fold(typed);
  if (start.length < 2) return [];
  return KEYS.filter((key) => key.startsWith(start) && (key !== "folder" || library.folders.length > 0)).map((key) => ({
    label: key === "after" || key === "before" ? `${key}:YYYY-MM-DD` : `${key}:`,
    text: `${key}:`,
  }));
}

/** Replaces the word being typed (a suggestion was chosen). */
export function replaceLastWord(words: string, replacement: string): string {
  const typed = lastWord(words);
  return words.slice(0, words.length - typed.length) + replacement;
}

/** The searched words, for bold: quoted parts as their words, filters left out. */
export function searchedTerms(words: string): string[] {
  return words
    .replace(/"/g, " ")
    .split(/\s+/)
    .filter((word) => word && !/^(is|feed|folder|after|before):/i.test(word))
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
