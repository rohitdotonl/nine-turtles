// The feed health page (SPEC section 17): the feeds that aren't working,
// what went wrong in plain words, and Retry, Find new address and
// Unsubscribe. The server sends a short problem word ("not-found"); only
// this file turns it into sentences, and no error code is ever shown.

import { when, type Choice } from "./feeds";
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
  /** How often it posts, in plain words ("Posts about once a week"), if the server said (decision 0105). */
  frequency: string | null;
};

/** Why an action on the page didn't work. */
export type HealthRefusal =
  | { error: "asked-to-wait"; until: number }
  | { error: "already" | "kept-stars" | "no-feed" | "not-found" | "unreachable" | "not-allowed" | "too-big" | "gone" | "trouble" };

export async function listSick(): Promise<Sick[]> {
  const response = await api("/api/health", { cache: "no-store" });
  if (!response.ok) throw new Error(`nine turtles answered ${response.status}`);
  const answer: unknown = await response.json();
  const feeds = isRecord(answer) && Array.isArray(answer.feeds) ? answer.feeds : [];
  return feeds.filter(isRecord).map(toSick);
}

/** Retry: the feed is checked now; answers how it's doing afterwards. */
export async function retry(id: number): Promise<Sick | HealthRefusal> {
  return feedOf(await post(`/api/health/${id}/retry`, {}));
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
      // Retry and Find new address wait for a publisher, who may be slow.
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
  const known = ["already", "kept-stars", "no-feed", "not-found", "unreachable", "not-allowed", "too-big"] as const;
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
    frequency: typeof feed.frequency === "string" && feed.frequency !== "" ? feed.frequency : null,
  };
}

const DAY = 24 * 60 * 60;

/** How long, in words: "for a day", "for 8 days", "for 3 weeks", "for 2 months". */
export function forHowLong(seconds: number): string {
  const days = Math.floor(seconds / DAY);
  if (days < 1) return "for less than a day";
  if (days === 1) return "for a day";
  if (days < 14) return `for ${days} days`;
  if (days < 60) return `for ${Math.floor(days / 7)} weeks`;
  const months = Math.floor(days / 30);
  return months < 24 ? `for ${months} months` : `for ${Math.floor(days / 365)} years`;
}

/** The first line about a feed: "Not found for 8 days", or "Hasn't worked for 3 weeks". */
export function headline(feed: Sick, now: number): string {
  if (feed.state === "working") return "Working again";
  if (feed.problem === "not-found" && feed.missingSince !== null) return `Not found ${forHowLong(now - feed.missingSince)}`;
  return `Hasn't worked ${forHowLong(now - (feed.failingSince ?? now))}`;
}

/** What went wrong, and what it may mean, in plain words. */
export function reason(problem: string | null): string {
  switch (problem) {
    case "not-found":
      return "The site says the feed isn't there any more. It may have moved.";
    case "unreachable":
      return "The site didn't answer. It may be down for a while, or gone.";
    case "not-a-feed":
      return "The address now leads to a page that isn't a feed. The site may have moved it.";
    case "too-big":
      return "The feed has grown bigger than nine turtles reads.";
    case "slow-down":
      return "The site asked nine turtles to slow down, so it's waiting as asked.";
    case "not-allowed":
      return "The address now points somewhere nine turtles never visits, such as a private network.";
    case "not-an-address":
      return "Its address isn't a web address nine turtles can read.";
  }
  const code = Number(problem?.match(/^answered-(\d{3})$/)?.[1]);
  if (code === 401 || code === 403) return "The site refuses to share this feed.";
  if (code >= 500) return "The site has a problem of its own. It may be fixed soon.";
  return "The site answered, but not with the feed.";
}

/** When it last worked, for the card's "Last worked" line: "Today", "3 Oct", or "Not since you added it". */
export function lastWorked(feed: Sick, now: Date = new Date()): string {
  if (feed.fetchedAt === null) return "Not since you added it";
  const at = when(feed.fetchedAt, now);
  return /^\d\d:\d\d$/.test(at) ? "Today" : at;
}

/**
 * The quiet line above a failing feed's list, and in Edit feed (decision
 * 0106): "This feed hasn't worked since 12 October." (with the year when it
 * isn't this one), in the device's time zone.
 */
export function brokenSince(failingSince: number, now: Date = new Date()): string {
  const date = new Date(failingSince * 1000);
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return "This feed hasn't worked since earlier today.";
  const day = date.getFullYear() === now.getFullYear() ? DAY_MONTH : DAY_MONTH_YEAR;
  return `This feed hasn't worked since ${day.format(date)}.`;
}

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

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

/** What Retry, Find new address or Use this address says when it couldn't. */
export function refusalMessage(refusal: HealthRefusal, doing: "retry" | "find" | "move"): string {
  switch (refusal.error) {
    case "asked-to-wait":
      return `The site asked nine turtles to wait until ${when(refusal.until)}, so it hasn't been asked again yet.`;
    case "already":
      return "You already follow that feed.";
    case "kept-stars":
      return "You followed the feed at that address before, and its starred articles are kept under it. Add it again with Add feed instead, then unsubscribe from this one.";
    case "no-feed":
      return doing === "find"
        ? "The site doesn't name another feed. You could try again another day, or unsubscribe."
        : "That address isn't a feed.";
    case "not-found":
      return doing === "find" ? "The site's home page wasn't found either." : "Nothing was found at that address.";
    case "unreachable":
      return "The site didn't answer. Try again later.";
    case "not-allowed":
      return "nine turtles can't visit that address.";
    case "too-big":
      return "That page is too big for nine turtles to read.";
    case "gone":
      return "This feed isn't here any more.";
    case "trouble":
      return "That didn't work just now. Try again in a moment.";
  }
}

