// Who isn't working, at the top of Everyone you follow (SPEC section 15,
// decisions 0186 and 0279): what went wrong in a few plain words, and Find
// new address on their page. The server sends a short problem word
// ("not-found"); only this file turns it into words, and no error code is
// ever shown.

import type { Choice } from "./feeds";
import { dayOrToday, until } from "./times";
import { api } from "./updates.svelte";
import { isRecord } from "./http";

/** Dead: a week of "not found" or three weeks of failing. Working: it worked when last tried. */
export type Condition = "dead" | "trouble" | "working";

export type Sick = {
  id: number;
  title: string;
  url: string;
  problem: string | null;
  failingSince: number | null;
  missingSince: number | null;
  /** When it last worked, if ever. */
  fetchedAt: number | null;
  state: Condition;
  /** A feed YouTube itself publishes, as the server judges it (decision 0272). */
  youtube: boolean;
};

/** Why an action on the page didn't work. */
export type HealthRefusal =
  | { error: "asked-to-wait"; until: number }
  | { error: "already" | "kept-stars" | "no-feed" | "not-found" | "unreachable" | "blocked" | "not-allowed" | "too-big" | "gone" | "trouble" };

export async function listSick(): Promise<Sick[]> {
  const response = await api("/api/health", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const answer: unknown = await response.json();
  const feeds = isRecord(answer) && Array.isArray(answer.feeds) ? answer.feeds : [];
  return feeds.filter(isRecord).map(toSick);
}

/** Find new address: the feeds the site names, other than this one. */
export async function findAddress(id: number): Promise<Choice[] | HealthRefusal> {
  const answer = await post(`/api/health/${id}/find`, {});
  if ("choices" in answer) return answer.choices;
  return "error" in answer ? answer : { error: "trouble" };
}

/** Use this address: moves the feed there, keeping everything it has. */
export async function moveTo(id: number, url: string): Promise<Sick | HealthRefusal> {
  return feedOf(await post(`/api/health/${id}/address`, { url }));
}

function feedOf(answer: Answer): Sick | HealthRefusal {
  if ("feed" in answer) return answer.feed;
  return "error" in answer ? answer : { error: "trouble" };
}

type Answer = { feed: Sick } | { choices: Choice[] } | HealthRefusal;

async function post(path: string, body: unknown): Promise<Answer> {
  let response: Response;
  try {
    response = await api(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // Find new address and Use this address wait for a publisher, who may be slow.
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return { error: "trouble" };
  }
  const answer: unknown = await response.json().catch(() => null);
  if (response.status === 404) return { error: "gone" };
  if (!isRecord(answer)) return { error: "trouble" };
  if (response.ok && isRecord(answer.feed)) return { feed: toSick(answer.feed) };
  if (response.ok && Array.isArray(answer.choices)) {
    return {
      choices: answer.choices.filter(isRecord).map((choice) => ({ title: String(choice.title ?? ""), url: String(choice.url ?? "") })),
    };
  }
  if (answer.error === "asked-to-wait" && typeof answer.until === "number") return { error: "asked-to-wait", until: answer.until };
  const known = ["already", "kept-stars", "no-feed", "not-found", "unreachable", "blocked", "not-allowed", "too-big"] as const;
  const error = known.find((word) => word === answer.error);
  return { error: error ?? "trouble" };
}

function toSick(feed: Record<string, unknown>): Sick {
  const number = (value: unknown) => (typeof value === "number" ? value : null);
  const state = feed.state === "dead" || feed.state === "working" ? feed.state : "trouble";
  return {
    id: Number(feed.id),
    title: String(feed.title ?? ""),
    url: String(feed.url ?? ""),
    problem: typeof feed.problem === "string" ? feed.problem : null,
    failingSince: number(feed.failing_since),
    missingSince: number(feed.missing_since),
    fetchedAt: number(feed.fetched_at),
    state,
    youtube: feed.youtube === true,
  };
}

/** "since 12 Oct", "since 3 Dec 2025" or "since earlier today". */
function since(at: number, now: Date): string {
  const day = dayOrToday(at, now);
  return day === "today" ? "since earlier today" : `since ${day}`;
}

/**
 * A YouTube feed YouTube won't send (decision 0272): not found, no answer, or
 * a problem of YouTube's own. The server says which feeds are YouTube's.
 */
export function youTubeRefusing(feed: Pick<Sick, "youtube" | "problem">): boolean {
  const { problem } = feed;
  return feed.youtube && (problem === "not-found" || problem === "unreachable" || Number(problem?.match(/^answered-(\d{3})$/)?.[1]) >= 500);
}

/** What went wrong, as a row says it: a few plain words, and the icon that stands for them. */
export type Reason = { words: string; icon: "feed-gone" | "site-down" | "page" | "shield" | "alert" | "video" };

/**
 * What went wrong, in a few plain words and never a code, with its icon
 * (decision 0279). A YouTube feed that YouTube won't send says so, rather
 * than that it's gone (decision 0272); a guard in front of the site is a
 * site that blocks (decision 0258).
 */
export function reason(feed: Pick<Sick, "youtube" | "problem">): Reason {
  if (youTubeRefusing(feed)) return { words: "YouTube not sending", icon: "video" };
  switch (feed.problem) {
    case "not-found":
      return { words: "Feed gone", icon: "feed-gone" };
    case "unreachable":
      return { words: "Site not answering", icon: "site-down" };
    case "not-a-feed":
      return { words: "Not a feed any more", icon: "page" };
    case "blocked":
      return { words: "Blocked by the site", icon: "shield" };
    case "not-allowed":
      return { words: "Address not allowed", icon: "shield" };
    case "too-big":
      return { words: "Feed too big", icon: "alert" };
    case "slow-down":
      return { words: "Site asked to wait", icon: "alert" };
    case "not-an-address":
      return { words: "Not a web address", icon: "alert" };
  }
  const code = Number(feed.problem?.match(/^answered-(\d{3})$/)?.[1]);
  if (code === 401 || code === 403) return { words: "Site won't share it", icon: "shield" };
  if (code >= 500) return { words: "Site has a problem", icon: "alert" };
  return { words: "Site sent something else", icon: "alert" };
}

/** Failing feeds, gathered by what went wrong so alike ones sit together, each reason where its longest failing feed was. */
export function byReason(feeds: Sick[]): Sick[] {
  const order = [...new Set(feeds.map((feed) => reason(feed).words))];
  return [...feeds].sort((one, other) => order.indexOf(reason(one).words) - order.indexOf(reason(other).words));
}

/**
 * The quiet line above a failing feed's list, and on their page, naming the source (decision
 * 0106): "This feed hasn't worked since 12 Oct." (with the year when it
 * isn't this one), in the device's time zone.
 */
export function brokenSince(failingSince: number, now: Date = new Date(), subject = "This feed"): string {
  return `${subject} hasn't worked ${since(failingSince, now)}.`;
}


/**
 * What Find new address found, as the next step (decision 0106): one feed
 * is a plain question ("Use … instead?"), several a choice of one, none a
 * plain sentence saying why.
 */
export type Found =
  | { kind: "one"; choice: Choice; said: string }
  | { kind: "several"; choices: Choice[]; said: string }
  | { kind: "none"; said: string };

export function found(answer: Choice[] | HealthRefusal): Found {
  if (!Array.isArray(answer)) return { kind: "none", said: refusalMessage(answer, "find") };
  const [first] = answer;
  if (!first) return { kind: "none", said: refusalMessage({ error: "no-feed" }, "find") };
  if (answer.length === 1) return { kind: "one", choice: first, said: `Use ${first.url} instead?` };
  return { kind: "several", choices: answer, said: "The site names these feeds. Choose one:" };
}

/** What Use it or Use this address says once the feed has moved. */
export const MOVED = "It now reads from its new address and works again. Its articles, stars and folders stayed.";

/** What Find new address or Use this address says when it couldn't. */
export function refusalMessage(refusal: HealthRefusal, doing: "find" | "move"): string {
  switch (refusal.error) {
    case "asked-to-wait":
      return `The site asked nine turtles to wait until ${until(refusal.until)}, so it hasn't been asked again yet.`;
    case "already":
      return "You already follow that feed.";
    case "kept-stars":
      return "You followed the feed at that address before, and its starred articles are kept under it. Add it again with + Add instead, then unsubscribe from this one.";
    case "no-feed":
      return doing === "find"
        ? "The site doesn't name another feed. You could try again another day, or unsubscribe."
        : "That address isn't a feed.";
    case "not-found":
      return doing === "find" ? "The site's home page wasn't found either." : "Nothing was found at that address.";
    case "unreachable":
      return "The site didn't answer. Try again later.";
    case "blocked":
      return "The site's guard against bots turned nine turtles away, so it couldn't look.";
    case "not-allowed":
      return "nine turtles can't visit that address.";
    case "too-big":
      return "That page is too big for nine turtles to read.";
    case "gone":
      return "This feed isn't here any more.";
    case "trouble":
      return doing === "find" ? "A new address couldn't be looked for. Try again in a moment." : "The feed couldn't be moved to that address. Try again in a moment.";
  }
}
