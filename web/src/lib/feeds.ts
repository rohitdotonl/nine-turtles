// Talking to the server about feeds and their articles (SPEC sections 3, 5,
// 6 and 7), and the words and times the screens show for them.

export type Feed = { id: number; title: string; siteUrl: string | null };

export type Article = {
  id: number;
  feedId: number;
  feedTitle: string;
  title: string;
  link: string | null;
  /** Seconds since 1970 (UTC). */
  at: number;
};

/** One article as the reading area shows it. `content` and `summary` are already cleaned by slowfeed. */
export type FullArticle = Article & {
  siteUrl: string | null;
  author: string | null;
  content: string | null;
  summary: string | null;
  /** The article's language (or its feed's), or null if neither says. */
  language: string | null;
};

/** One page of the item list. `older` is where the next page starts, or null at the end. */
export type Page = { articles: Article[]; older: string | null };

export type Choice = { title: string; url: string };

export type AddResult =
  | { kind: "added"; feed: Feed }
  | { kind: "choose"; choices: Choice[] }
  | { kind: "already"; feedId: number }
  | { kind: "problem"; reason: Problem };

export type Problem =
  | "not-an-address"
  | "not-allowed"
  | "unreachable"
  | "not-found"
  | "too-big"
  | "no-feed"
  | "trouble";

const PROBLEMS: Problem[] = ["not-an-address", "not-allowed", "unreachable", "not-found", "too-big", "no-feed"];

export async function listFeeds(): Promise<Feed[]> {
  const body = await getJson("/api/feeds");
  const feeds = isRecord(body) && Array.isArray(body.feeds) ? body.feeds : [];
  return feeds.filter(isRecord).map(toFeed);
}

export async function listArticles(feedId: number | null, before: string | null): Promise<Page> {
  const query = new URLSearchParams();
  if (feedId !== null) query.set("feed", String(feedId));
  if (before !== null) query.set("before", before);
  const text = query.toString();
  const body = await getJson(`/api/articles${text ? `?${text}` : ""}`);
  if (!isRecord(body) || !Array.isArray(body.articles)) throw new Error("slowfeed sent an unexpected answer");
  return {
    articles: body.articles.filter(isRecord).map(toArticle),
    older: typeof body.older === "string" ? body.older : null,
  };
}

// Articles already fetched, so moving back and forth with j and k never
// waits. Kept small: only the last few are needed.
const loaded = new Map<number, FullArticle>();
const loading = new Map<number, Promise<FullArticle>>();
const KEEP = 20;

/** The article, if it's already here, without waiting. */
export function articleNow(id: number): FullArticle | undefined {
  return loaded.get(id);
}

/** The article, from the ones already here or from the server. */
export function readArticle(id: number): Promise<FullArticle> {
  const here = loaded.get(id);
  if (here) return Promise.resolve(here);
  const pending = loading.get(id);
  if (pending) return pending;
  const request = getJson(`/api/articles/${id}`)
    .then((body) => {
      if (!isRecord(body) || !isRecord(body.article)) throw new Error("slowfeed sent an unexpected answer");
      const article = toFullArticle(body.article);
      loaded.set(id, article);
      if (loaded.size > KEEP) loaded.delete(loaded.keys().next().value as number);
      return article;
    })
    .finally(() => loading.delete(id));
  loading.set(id, request);
  return request;
}

/** Fetches an article in advance, so it shows at once when asked for. */
export function prefetch(id: number): void {
  readArticle(id).catch(() => {
    // Nothing to do: it's fetched again when actually opened.
  });
}

/** Follows a feed from a feed's or a website's address. */
export async function addFeed(address: string): Promise<AddResult> {
  let response: Response;
  try {
    response = await fetch("/api/feeds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    });
  } catch {
    return { kind: "problem", reason: "trouble" };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) return { kind: "problem", reason: "trouble" };
  if (isRecord(body.feed)) return { kind: "added", feed: toFeed(body.feed) };
  if (Array.isArray(body.choices)) {
    const choices = body.choices.filter(isRecord).map((choice) => ({
      title: String(choice.title ?? ""),
      url: String(choice.url ?? ""),
    }));
    return { kind: "choose", choices };
  }
  if (body.error === "already" && typeof body.feed_id === "number") return { kind: "already", feedId: body.feed_id };
  const reason = PROBLEMS.find((problem) => problem === body.error) ?? "trouble";
  return { kind: "problem", reason };
}

/** What the add field says when a feed couldn't be added. Plain and calm. */
export function explain(reason: Problem): string {
  switch (reason) {
    case "not-an-address":
      return "That doesn't look like a web address.";
    case "not-allowed":
      return "slowfeed can't visit that address.";
    case "unreachable":
      return "That site didn't answer. Try again later.";
    case "not-found":
      return "Nothing was found at that address.";
    case "too-big":
      return "That file is too big to be a feed.";
    case "no-feed":
      return "This site doesn't seem to offer a feed.";
    case "trouble":
      return "slowfeed couldn't add that just now. Try again in a moment.";
  }
}

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_AND_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * An article's time, in the device's time zone, in words that never change
 * while you look: "14:05" today, "23 Oct" this year, "23 Oct 2025" before.
 */
export function when(at: number, now: Date = new Date()): string {
  const date = new Date(at * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return TIME.format(date);
  if (date.getFullYear() === now.getFullYear()) return DAY.format(date);
  return DAY_AND_YEAR.format(date);
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`slowfeed answered ${response.status}`);
  return response.json();
}

function toArticle(article: Record<string, unknown>): Article {
  return {
    id: Number(article.id),
    feedId: Number(article.feed_id),
    feedTitle: String(article.feed_title ?? ""),
    title: String(article.title ?? ""),
    link: text(article.link),
    at: Number(article.at),
  };
}

function toFullArticle(article: Record<string, unknown>): FullArticle {
  return {
    ...toArticle(article),
    siteUrl: text(article.site_url),
    author: text(article.author),
    content: text(article.content),
    summary: text(article.summary),
    language: text(article.language),
  };
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toFeed(feed: Record<string, unknown>): Feed {
  return {
    id: Number(feed.id),
    title: String(feed.title ?? ""),
    siteUrl: text(feed.site_url),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
