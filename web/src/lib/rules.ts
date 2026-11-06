// Hiding (SPEC section 27): a list of words, each hiding articles about it
// from everyone or one person, for a week, a month or for good (decision
// 0197). This file talks to the server about them and writes each in words,
// the way Settings › Hiding lists it.

import { rowFor } from "./people";
import { toArticle, type Article, type Feed } from "./shapes";
import { getJson, isRecord, sendChange } from "./http";

export type Rule = {
  id: number;
  /** The word or phrase it hides articles about. */
  words: string;
  /** An old rule from before hiding looks in titles only; new ones look in the text too. */
  titleOnly: boolean;
  /** The person it hides from, by any of their places; null for everyone. */
  feedId: number | null;
  /** The person it applied to is no longer followed, so it matches nothing. */
  placeGone: boolean;
  /** Paused before the switch went (decision 0197): it hides nothing. */
  paused: boolean;
  /** When it stops hiding, in seconds since 1970; null for good. */
  until: number | null;
};

/** What Settings sends: a new word, or a removed rule made again by Undo. */
export type RuleDraft = Pick<Rule, "words" | "feedId"> & {
  /** For a week (7) or a month (30); absent for good. */
  days?: 7 | 30;
  titleOnly?: boolean;
  paused?: boolean;
  /** Only when Undo makes a deleted rule again whose person had gone. */
  placeGone?: boolean;
  until?: number | null;
};

/** Why a rule wasn't saved. */
export type RuleRefusal = "nothing-to-match" | "too-long" | "no-place" | "bad-days" | "gone" | "trouble";

export async function listRules(): Promise<{ rules: Rule[]; muted: number }> {
  const answer = await getJson("/api/rules");
  const rules = isRecord(answer) && Array.isArray(answer.rules) ? answer.rules : [];
  return {
    rules: rules.filter(isRecord).map(toRule),
    muted: isRecord(answer) ? Number(answer.muted ?? 0) : 0,
  };
}

/** Makes a rule, which hides at once the unread articles already about it. Answers its number and exactly those, for Undo. */
export async function createRule(draft: RuleDraft): Promise<{ id: number; ids: number[] } | RuleRefusal> {
  const sent = await post("/api/rules", body(draft));
  if (typeof sent === "string") return sent;
  return { id: Number(sent.id), ids: Array.isArray(sent.ids) ? sent.ids.map(Number) : [] };
}

export async function deleteRule(id: number): Promise<RuleRefusal | undefined> {
  const sent = await post(`/api/rules/${id}/delete`, {});
  return typeof sent === "string" ? sent : undefined;
}

/** The Hidden articles page: the newest hidden articles, and how many there are in all. */
export async function listMuted(): Promise<{ articles: Article[]; count: number }> {
  const answer = await getJson("/api/muted");
  const articles = isRecord(answer) && Array.isArray(answer.articles) ? answer.articles : [];
  return { articles: articles.filter(isRecord).map(toArticle), count: isRecord(answer) ? Number(answer.count ?? 0) : 0 };
}

/** Unhides articles (they come back unread), or hides them again (Undo). */
export async function setMuted(ids: number[], muted: boolean): Promise<RuleRefusal | undefined> {
  const sent = await post("/api/articles/muted", { ids, muted });
  return typeof sent === "string" ? sent : undefined;
}

/** Who a rule hides from, in words: "Everyone", "Alpha", or "Someone you no longer follow". */
export function whoWords(rule: Pick<Rule, "feedId" | "placeGone">, people: Feed[]): string {
  if (rule.placeGone) return "Someone you no longer follow";
  if (rule.feedId === null) return "Everyone";
  return rowFor(rule.feedId, people)?.title ?? "Someone you no longer follow";
}

/** A word as its row shows it: “sponsored”, and “x” (in titles) for an old rule that looks in titles only. */
export function wordShown(rule: Pick<Rule, "words" | "titleOnly">): string {
  return `“${rule.words.trim()}”${rule.titleOnly ? " (in titles)" : ""}`;
}

/** How long a word still hides: "for good", "5 days left" (whole days, rounded up), or "paused" for one paused before the switch went. */
export function howLong(rule: Pick<Rule, "until" | "paused">, now: number): string {
  if (rule.paused) return "paused";
  if (rule.until === null) return "for good";
  const days = Math.max(1, Math.ceil((rule.until - now) / 86_400));
  return days === 1 ? "1 day left" : `${days} days left`;
}

/** A word's row, under the word: whose articles it hides, and for how long ("Everyone · for good"). */
export function ruleLine(rule: Rule, people: Feed[], now: number): string {
  return `${whoWords(rule, people)} · ${howLong(rule, now)}`;
}

/** What Settings says once a word is added, with what it hid at once. */
export function addedMessage(words: string, hid: number, days?: 7 | 30): string {
  const when = days === 7 ? ", for a week" : days === 30 ? ", for a month" : "";
  const word = `“${words}”`;
  if (hid === 0) return `Hiding ${word}${when}. Nothing unread is about it yet.`;
  return `Hid ${hid === 1 ? "1 unread article" : `${hid} unread articles`} about ${word}${when}.`;
}

/** What Settings says when a word wasn't saved. */
export function ruleRefused(refusal: RuleRefusal): string {
  switch (refusal) {
    case "nothing-to-match":
      return "Write a word or phrase to hide articles about.";
    case "too-long":
      return "That's too long: keep it to 200 characters.";
    case "no-place":
      return "You no longer follow them.";
    case "bad-days":
      return "Choose a week, a month or for good.";
    case "gone":
      return "This isn't here any more.";
    case "trouble":
      return "That couldn't be saved. Try again in a moment.";
  }
}

function body(draft: RuleDraft): Record<string, unknown> {
  return {
    words: draft.words,
    feed_id: draft.feedId,
    title_only: draft.titleOnly ?? false,
    paused: draft.paused ?? false,
    place_gone: draft.placeGone ?? false,
    days: draft.days ?? null,
    until: draft.until ?? null,
  };
}

async function post(path: string, change: unknown): Promise<Record<string, unknown> | RuleRefusal> {
  const sent = await sendChange(path, change, ["nothing-to-match", "too-long", "no-place", "bad-days"]);
  return sent.refusal ?? sent.answer ?? {};
}

function toRule(rule: Record<string, unknown>): Rule {
  return {
    id: Number(rule.id),
    words: String(rule.words ?? ""),
    titleOnly: rule.title_only === true,
    feedId: typeof rule.feed_id === "number" ? rule.feed_id : null,
    placeGone: rule.place_gone === true,
    paused: rule.paused === true,
    until: typeof rule.until === "number" ? rule.until : null,
  };
}
