// The shapes of what nine turtles' server sends about feeds, folders and
// articles, as the screens use them, and how its answers are read into them.
import type { View } from "./router";
import { isRecord } from "./http";
import { episodeFrom, type Episode } from "./podcasts";

export type Feed = {
  id: number;
  title: string;
  siteUrl: string | null;
  /** How many of its articles are unread (none for a feed that flows past). */
  unread: number;
  /** The folders it's in, by number. */
  folders: number[];
  /** When the reader paused it (seconds since 1970), or null while it isn't paused (SPEC section 15). */
  pausedAt?: number | null;
  /**
   * When its checks began failing (seconds since 1970), while the feed health
   * page lists it as not working; null while it works (decision 0106).
   */
  failingSince?: number | null;
} & FeedSettings;

/**
 * A feed's own settings, chosen in Edit feed (SPEC section 15): it flows
 * past as in river mode (no Unread, no count), how often it may be checked,
 * and whether opening one of its articles opens the publisher's page.
 */
export type FeedSettings = { river: boolean; check: Check; openOnSite: boolean };

/** How often a feed is checked in the background: on its own rhythm, or at most hourly or daily. */
export type Check = "automatic" | "hourly" | "daily";

export type Folder = { id: number; name: string };

/** Everything the sidebar lists: feeds and folders, each A to Z; and, where search needs them, the reader's collections (decision 0108). */
export type Library = { feeds: Feed[]; folders: Folder[]; collections?: { id: number; name: string }[] };

export type Article = {
  id: number;
  feedId: number;
  feedTitle: string;
  title: string;
  link: string | null;
  /** Seconds since 1970 (UTC). */
  at: number;
  read: boolean;
  starred: boolean;
  /** A rule (or the reader) muted it: only search, the Muted page and Starred show it (SPEC section 27). */
  muted: boolean;
  /**
   * A search result's line of its text around the first searched word, in
   * plain-text pieces, the searched words marked (SPEC section 14). Absent
   * outside search, and when the words were only in the title.
   */
  excerpt?: ExcerptPiece[];
  /** A podcast's episode (SPEC section 35): its row shows a small headphones mark, and its length if known. */
  episode?: boolean;
  /** How long the episode plays, in seconds, if its feed says. */
  episodeSeconds?: number | null;
  /** Only in Recently read: when the reader last opened it (seconds since 1970), for its day headings. */
  opened?: number;
};

/** A piece of a search result's excerpt: plain text, never HTML. */
export type ExcerptPiece = { text: string; match: boolean };

/** One article as the reading area shows it. `content` and `summary` are already cleaned by nine turtles. */
export type FullArticle = Article & {
  siteUrl: string | null;
  author: string | null;
  content: string | null;
  summary: string | null;
  /** The article's language (or its feed's), or null if neither says. */
  language: string | null;
  /** Its audio file, if it's a podcast's episode (SPEC section 35): played from the publisher's own address. */
  audio?: Episode | null;
};

/**
 * One page of the item list. `next` is where the next page starts, or null
 * at the end. `latest` is the newest article's number when it was loaded, to
 * ask later whether anything new has arrived.
 */
export type Page = {
  articles: Article[];
  next: string | null;
  latest: number;
  /** Listed from the copies kept on this device, without a connection (SPEC section 32). */
  kept?: boolean;
};

/**
 * Which articles a list shows: one of the views, one feed's or folder's (all
 * of them), or a search's results (`search.ts` → `searchParams`).
 */
export type Source = { view: View } | { feed: number } | { folder: number } | { collection: number } | { search: Record<string, string> };

export function toArticle(article: Record<string, unknown>): Article {
  return {
    id: Number(article.id),
    feedId: Number(article.feed_id),
    feedTitle: String(article.feed_title ?? ""),
    title: String(article.title ?? ""),
    link: text(article.link),
    at: Number(article.at),
    read: article.read === true,
    starred: article.starred === true,
    muted: article.muted === true,
    ...(Array.isArray(article.excerpt) ? { excerpt: toExcerpt(article.excerpt) } : {}),
    ...(typeof article.opened === "number" ? { opened: article.opened } : {}),
    ...(article.episode === true || typeof article.episode_url === "string"
      ? { episode: true, episodeSeconds: typeof article.episode_seconds === "number" ? article.episode_seconds : null }
      : {}),
  };
}

/** Only well-formed pieces, each kept as text. */
export function toExcerpt(pieces: unknown[]): ExcerptPiece[] {
  return pieces.filter(isRecord).map((piece) => ({ text: String(piece.text ?? ""), match: piece.match === true }));
}

export function toFullArticle(article: Record<string, unknown>): FullArticle {
  return {
    ...toArticle(article),
    siteUrl: text(article.site_url),
    author: text(article.author),
    content: text(article.content),
    summary: text(article.summary),
    language: text(article.language),
    audio: episodeFrom(article),
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function toFeed(feed: Record<string, unknown>): Feed {
  return {
    id: Number(feed.id),
    title: String(feed.title ?? ""),
    siteUrl: text(feed.site_url),
    unread: Number(feed.unread ?? 0),
    folders: Array.isArray(feed.folders) ? feed.folders.map(Number) : [],
    river: feed.river === true,
    check: checkFrom(Number(feed.check_at_most ?? 0)),
    openOnSite: feed.open_on_site === true,
    pausedAt: typeof feed.paused_at === "number" ? feed.paused_at : null,
    failingSince: typeof feed.failing_since === "number" ? feed.failing_since : null,
  };
}

/** The server keeps the shortest wait in seconds: 0, an hour or a day. */
export function checkFrom(seconds: number): Check {
  if (seconds >= 24 * 60 * 60) return "daily";
  if (seconds >= 60 * 60) return "hourly";
  return "automatic";
}
