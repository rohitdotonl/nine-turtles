// Who isn't working, at the top of Everyone you follow (SPEC section 15,
// decision 0186): what went wrong in plain words, with Find new address and
// Unsubscribe. The server sends a short problem word ("not-found"); only
// this file turns it into sentences, and no error code is ever shown.

import type { Choice } from "./feeds";
import { dayOrToday, when } from "./times";
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
  };
}

/** "since 12 Oct", "since 3 Dec 2025" or "since earlier today". */
function since(at: number, now: Date): string {
  const day = dayOrToday(at, now);
  return day === "today" ? "since earlier today" : `since ${day}`;
}

/** The first line about a feed: "Nothing has come through since 1 Nov", or "Working again" once it has moved. */
export function headline(feed: Sick, now: Date = new Date()): string {
  if (feed.state === "working") return "Working again";
  const from = feed.problem === "not-found" && feed.missingSince !== null ? feed.missingSince : feed.failingSince;
  return from === null ? "Nothing has come through lately" : `Nothing has come through ${since(from, now)}`;
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
      return "The address now points somewhere nine turtles never visits.";
    case "not-an-address":
      return "Its address isn't a web address nine turtles can read.";
  }
  const code = Number(problem?.match(/^answered-(\d{3})$/)?.[1]);
  if (code === 401 || code === 403) return "The site refuses to share this feed.";
  if (code >= 500) return "The site has a problem of its own. It may be fixed soon.";
  return "The site answered, but not with the feed.";
}

/**
 * The quiet line above a failing feed's list, and in Edit feed (decision
 * 0106): "This feed hasn't worked since 12 Oct." (with the year when it
 * isn't this one), in the device's time zone.
 */
export function brokenSince(failingSince: number, now: Date = new Date()): string {
  return `This feed hasn't worked ${since(failingSince, now)}.`;
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
      return `The site asked nine turtles to wait until ${when(refusal.until)}, so it hasn't been asked again yet.`;
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
