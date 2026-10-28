// Rules and mutes (SPEC section 27): "when a new article matches this, do
// that", in plain fields. This file talks to the server about them and
// writes each rule as one plain sentence, the way Settings lists it.

import { toArticle, type Article, type Feed, type Folder } from "./feeds";
import { getJson, isRecord, sendChange } from "./http";

/** Mute: kept, counted as read, shown only in search and on the Muted page. */
export type RuleAction = "mute" | "star" | "read";

export type Rule = {
  id: number;
  /** A word or phrase to look for; "" for none. */
  words: string;
  /** Look only in the title, not the text. */
  titleOnly: boolean;
  /** An author's name to look for; "" for any. */
  author: string;
  /** One feed, one folder, or (both null) every feed. */
  feedId: number | null;
  folderId: number | null;
  /** The feed or folder it applied to is gone, so it matches nothing. */
  placeGone: boolean;
  action: RuleAction;
  paused: boolean;
};

/** What the rule editor sends: a rule without its number or its state. */
export type RuleDraft = Pick<Rule, "words" | "titleOnly" | "author" | "feedId" | "folderId" | "action"> & {
  paused?: boolean;
  /** Only when Undo makes a deleted rule again whose place had gone. */
  placeGone?: boolean;
};

export const ACTIONS: { value: RuleAction; label: string }[] = [
  { value: "mute", label: "Mute" },
  { value: "star", label: "Star" },
  { value: "read", label: "Mark as read" },
];

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

/** Undoes applying a rule: the opposite mark, on exactly the articles it changed. */
export async function unapply(action: RuleAction, ids: number[]): Promise<RuleRefusal | undefined> {
  const [path, change] =
    action === "mute"
      ? ["/api/articles/muted", { ids, muted: false }]
      : action === "star"
        ? ["/api/articles/starred", { ids, starred: false }]
        : ["/api/articles/read", { ids, read: false }];
  const sent = await post(path, change);
  return typeof sent === "string" ? sent : undefined;
}

/** The Muted page: the newest muted articles, and how many there are in all. */
export async function listMuted(): Promise<{ articles: Article[]; count: number }> {
  const answer = await getJson("/api/muted");
  const articles = isRecord(answer) && Array.isArray(answer.articles) ? answer.articles : [];
  return { articles: articles.filter(isRecord).map(toArticle), count: isRecord(answer) ? Number(answer.count ?? 0) : 0 };
}

/** Unmutes articles (they come back unread), or mutes them again (Undo). */
export async function setMuted(ids: number[], muted: boolean): Promise<RuleRefusal | undefined> {
  const sent = await post("/api/articles/muted", { ids, muted });
  return typeof sent === "string" ? sent : undefined;
}

/**
 * A rule as one plain sentence: "Mute articles with “sponsored” in the
 * title, in all feeds."
 */
export function describe(rule: Pick<Rule, "words" | "titleOnly" | "author" | "feedId" | "folderId" | "placeGone" | "action">, feeds: Feed[], folders: Folder[]): string {
  const words = rule.words.trim();
  const author = rule.author.trim();
  const parts: string[] = [];
  if (words) parts.push(`with “${words}” in the ${rule.titleOnly ? "title" : "title or text"}`);
  if (author) parts.push(`by ${author}`);
  const what = parts.join(", ");
  const doing = rule.action === "mute" ? `Mute articles ${what}` : rule.action === "star" ? `Star articles ${what}` : `Mark as read any article ${what}`;
  return `${doing}, ${placeWords(rule, feeds, folders)}.`;
}

/** Where a rule applies, in words: "in all feeds", "in the Tech folder", "in Garden Notes". */
export function placeWords(rule: Pick<Rule, "feedId" | "folderId" | "placeGone">, feeds: Feed[], folders: Folder[]): string {
  if (rule.placeGone) return "in a feed or folder that's gone";
  if (rule.feedId !== null) {
    const feed = feeds.find((one) => one.id === rule.feedId);
    return feed ? `in ${feed.title}` : "in a feed you no longer follow";
  }
  if (rule.folderId !== null) {
    const folder = folders.find((one) => one.id === rule.folderId);
    return folder ? `in the ${folder.name} folder` : "in a folder that's gone";
  }
  return "in all feeds";
}

/** The question asked once a new rule is saved, when articles already match it. */
export function applyQuestion(action: RuleAction, count: number): string {
  const articles = count === 1 ? "the 1 unread article that matches" : `the ${count} unread articles that match`;
  const verb = action === "mute" ? "Also mute" : action === "star" ? "Also star" : "Also mark as read";
  return `${verb} ${articles}?`;
}

/** What Settings says once a rule was applied to articles already here. */
export function appliedMessage(action: RuleAction, count: number): string {
  const articles = count === 1 ? "1 article" : `${count} articles`;
  return action === "mute" ? `Muted ${articles}.` : action === "star" ? `Starred ${articles}.` : `Marked ${articles} as read.`;
}

/** What the rule editor says when a rule wasn't saved. */
export function ruleRefused(refusal: RuleRefusal): string {
  switch (refusal) {
    case "nothing-to-match":
      return "Write a word, a phrase or an author to look for.";
    case "too-long":
      return "That's too long: keep each to 200 characters.";
    case "no-place":
      return "That feed or folder isn't here any more. Choose another.";
    case "gone":
      return "This rule isn't here any more.";
    case "trouble":
      return "That couldn't be saved. Try again in a moment.";
  }
}

function body(draft: RuleDraft): Record<string, unknown> {
  return {
    words: draft.words,
    title_only: draft.titleOnly,
    author: draft.author,
    feed_id: draft.feedId,
    folder_id: draft.folderId,
    action: draft.action,
    paused: draft.paused ?? false,
    place_gone: draft.placeGone ?? false,
  };
}

async function post(path: string, change: unknown): Promise<Record<string, unknown> | RuleRefusal> {
  const sent = await sendChange(path, change, ["nothing-to-match", "too-long", "no-place"]);
  return sent.refusal ?? sent.answer ?? {};
}

function toRule(rule: Record<string, unknown>): Rule {
  const action = rule.action === "star" || rule.action === "read" ? rule.action : "mute";
  return {
    id: Number(rule.id),
    words: String(rule.words ?? ""),
    titleOnly: rule.title_only === true,
    author: String(rule.author ?? ""),
    feedId: typeof rule.feed_id === "number" ? rule.feed_id : null,
    folderId: typeof rule.folder_id === "number" ? rule.folder_id : null,
    placeGone: rule.place_gone === true,
    action,
    paused: rule.paused === true,
  };
}
