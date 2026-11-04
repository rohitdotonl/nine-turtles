// Hiding (SPEC section 27): "Hide articles about [words] from [everyone /
// this person]", one sentence the reader fills in. This file talks to the
// server about rules and writes each one as that sentence, the way Settings
// › Hiding lists it.

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
  paused: boolean;
};

/** What the editor sends: a rule without its number or its state. */
export type RuleDraft = Pick<Rule, "words" | "feedId"> & {
  titleOnly?: boolean;
  paused?: boolean;
  /** Only when Undo makes a deleted rule again whose person had gone. */
  placeGone?: boolean;
};

/** The one quiet line under the editor's sentence. */
export const HIDING_HELP = "Hidden articles are kept and marked read. Search still finds them.";

/**
 * The words the person blank shows: "everyone", a person's name, or
 * "choose someone…" while none is chosen. `who` is the editor's menu value:
 * "all", a place's number, or "".
 */
export function whoChoice(who: string, people: Feed[]): string {
  if (who === "") return "choose someone…";
  if (who === "all") return "everyone";
  return rowFor(Number(who), people)?.title ?? "";
}

/**
 * How wide a blank in the rule's sentence is, as CSS: about half an em per
 * letter of its words (28 at most), plus room for a menu's small arrow
 * (1.25rem) or a field's edge (0.3rem), so the sentence reads without gaps.
 */
export function blankWidth(words: string, room = 1.25): string {
  return `calc(${Math.min(words.length, 28) * 0.5 + 0.3}em + ${room}rem)`;
}

/** Why a rule wasn't saved. */
export type RuleRefusal = "nothing-to-match" | "too-long" | "no-place" | "gone" | "trouble";

export async function listRules(): Promise<{ rules: Rule[]; muted: number }> {
  const answer = await getJson("/api/rules");
  const rules = isRecord(answer) && Array.isArray(answer.rules) ? answer.rules : [];
  return {
    rules: rules.filter(isRecord).map(toRule),
    muted: isRecord(answer) ? Number(answer.muted ?? 0) : 0,
  };
}

/** Makes a rule. Answers its number and how many unread articles already match it. */
export async function createRule(draft: RuleDraft): Promise<{ id: number; matching: number } | RuleRefusal> {
  const sent = await post("/api/rules", body(draft));
  if (typeof sent === "string") return sent;
  return { id: Number(sent.id), matching: Number(sent.matching ?? 0) };
}

export async function editRule(id: number, draft: RuleDraft): Promise<RuleRefusal | undefined> {
  const sent = await post(`/api/rules/${id}`, body(draft));
  return typeof sent === "string" ? sent : undefined;
}

export async function pauseRule(id: number, paused: boolean): Promise<RuleRefusal | undefined> {
  const sent = await post(`/api/rules/${id}/paused`, { paused });
  return typeof sent === "string" ? sent : undefined;
}

export async function deleteRule(id: number): Promise<RuleRefusal | undefined> {
  const sent = await post(`/api/rules/${id}/delete`, {});
  return typeof sent === "string" ? sent : undefined;
}

/** Applies a rule once to the unread articles that match it now. Answers exactly those, for Undo. */
export async function applyRule(id: number): Promise<number[] | RuleRefusal> {
  const sent = await post(`/api/rules/${id}/apply`, {});
  if (typeof sent === "string") return sent;
  return Array.isArray(sent.ids) ? sent.ids.map(Number) : [];
}

/** Undoes applying a rule: exactly the articles it hid come back. */
export async function unapply(ids: number[]): Promise<RuleRefusal | undefined> {
  return setMuted(ids, false);
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

/**
 * A rule as one plain sentence: "Hide articles about “crypto” from
 * everyone." An old title-only rule says so: "about “x” (in titles)".
 */
export function describe(rule: Pick<Rule, "words" | "titleOnly" | "feedId" | "placeGone">, people: Feed[]): string {
  const about = `about “${rule.words.trim()}”${rule.titleOnly ? " (in titles)" : ""}`;
  return `Hide articles ${about} from ${whoWords(rule, people)}.`;
}

/** Who a rule hides from, in words: "everyone", "Alpha", or "someone you no longer follow". */
export function whoWords(rule: Pick<Rule, "feedId" | "placeGone">, people: Feed[]): string {
  if (rule.placeGone) return "someone you no longer follow";
  if (rule.feedId === null) return "everyone";
  return rowFor(rule.feedId, people)?.title ?? "someone you no longer follow";
}

/** The question asked once a new rule is saved, when unread articles already match it. */
export function applyQuestion(count: number): string {
  return count === 1 ? "Also hide the 1 unread article that matches?" : `Also hide the ${count} unread articles that match?`;
}

/** What Settings says once a rule was applied to articles already here. */
export function appliedMessage(count: number): string {
  return count === 1 ? "Hid 1 article." : `Hid ${count} articles.`;
}

/** What the rule editor says when a rule wasn't saved. */
export function ruleRefused(refusal: RuleRefusal): string {
  switch (refusal) {
    case "nothing-to-match":
      return "Write a word or phrase to hide articles about.";
    case "too-long":
      return "That's too long: keep it to 200 characters.";
    case "no-place":
      return "You no longer follow them. Choose someone else.";
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
  };
}

async function post(path: string, change: unknown): Promise<Record<string, unknown> | RuleRefusal> {
  const sent = await sendChange(path, change, ["nothing-to-match", "too-long", "no-place"]);
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
  };
}
