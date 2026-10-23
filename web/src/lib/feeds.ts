// Talking to the server about feeds and their articles (SPEC sections 3, 5
// and 6), and the words and times the screens show for them.

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
    articles: body.articles.filter(isRecord).map((article) => ({
      id: Number(article.id),
      feedId: Number(article.feed_id),
      feedTitle: String(article.feed_title ?? ""),
      title: String(article.title ?? ""),
      link: typeof article.link === "string" ? article.link : null,
      at: Number(article.at),
    })),
    older: typeof body.older === "string" ? body.older : null,
  };
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

function toFeed(feed: Record<string, unknown>): Feed {
  return {
    id: Number(feed.id),
    title: String(feed.title ?? ""),
    siteUrl: typeof feed.site_url === "string" ? feed.site_url : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
