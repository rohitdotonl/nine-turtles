// Importing a feed list (OPML, SPEC section 16) or starred articles from
// another feed reader (SPEC section 23), and the plain summaries after.
import { api } from "./updates.svelte";
import { isRecord } from "./http";
import { PLAN_ENDED } from "./feeds";

/** What an OPML import did. */
export type ImportSummary = { added: number; already: number; foldersAdded: number; unreadable: string[] };

/** Imports an OPML file's feeds and folders. A string is a problem, said plainly. */
export async function importOpml(file: File): Promise<ImportSummary | string> {
  let response: Response;
  try {
    response = await api("/api/opml", {
      method: "POST",
      headers: { "content-type": "text/x-opml" },
      body: await file.text(),
    });
  } catch {
    return "The file couldn't be sent. Try again in a moment.";
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isRecord(body) && isRecord(body.summary)) {
    const summary = body.summary;
    return {
      added: Number(summary.added ?? 0),
      already: Number(summary.already ?? 0),
      foldersAdded: Number(summary.folders_added ?? 0),
      unreadable: Array.isArray(summary.unreadable) ? summary.unreadable.map(String) : [],
    };
  }
  if (isRecord(body) && body.error === "not-opml") return "That file doesn't look like an OPML file.";
  if (isRecord(body) && body.error === "plan-ended") return PLAN_ENDED;
  if (isRecord(body) && body.error === "too-many") {
    return tooManyToImport(Number(body.following ?? 0), Number(body.adding ?? 0), Number(body.most ?? 1000));
  }
  if (response.status === 413) return "That file lists more feeds than nine turtles can take at once.";
  return "The file couldn't be imported. Try again in a moment.";
}

/** Why nothing was imported: the file would take the reader past the most feeds one reader can follow. */
export function tooManyToImport(following: number, adding: number, most: number): string {
  const number = new Intl.NumberFormat("en-GB");
  const feeds = (count: number) => `${number.format(count)} ${count === 1 ? "feed" : "feeds"}`;
  return `Nothing was imported. You follow ${feeds(following)}, and this file would add ${number.format(adding)} more, past the ${number.format(most)} one reader can follow.`;
}

/** The plain summary after an import (SPEC section 16). */
export function importMessage(summary: ImportSummary): string[] {
  const count = (number: number, one: string, many: string) => `${number} ${number === 1 ? one : many}`;
  const lines = [
    summary.added === 0
      ? "No new feeds were added."
      : `Added ${count(summary.added, "feed", "feeds")}${summary.foldersAdded > 0 ? ` and ${count(summary.foldersAdded, "folder", "folders")}` : ""}. ${summary.added === 1 ? "Its" : "Their"} articles arrive over the next few minutes.`,
  ];
  if (summary.already > 0) {
    lines.push(`${count(summary.already, "feed was", "feeds were")} already here, so ${summary.already === 1 ? "it wasn't" : "they weren't"} added again.`);
  }
  if (summary.unreadable.length > 0) {
    lines.push(`${count(summary.unreadable.length, "line", "lines")} couldn't be read: ${summary.unreadable.join(", ")}.`);
  }
  return lines;
}

export type StarsSummary = { starred: number; already: number; unreadable: number };

/** Imports a file of starred articles from another feed reader (SPEC section 23). A string is a problem, said plainly. */
export async function importStars(file: File): Promise<StarsSummary | string> {
  let response: Response;
  try {
    response = await api("/api/starred/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await file.text(),
    });
  } catch {
    return "The file couldn't be sent. Try again in a moment.";
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isRecord(body) && isRecord(body.summary)) {
    const summary = body.summary;
    return {
      starred: Number(summary.starred ?? 0),
      already: Number(summary.already ?? 0),
      unreadable: Number(summary.unreadable ?? 0),
    };
  }
  if (isRecord(body) && body.error === "not-stars") {
    return "That file doesn't look like starred articles from a feed reader. Choose the JSON file your other app exports them in.";
  }
  if (isRecord(body) && body.error === "too-much") {
    return "Nothing was imported. With this file you'd keep more than 10,000 imported articles (or 50 MB of their text), as many as one reader can.";
  }
  if (response.status === 413) return "That file holds more than nine turtles can take at once (10,000 articles, or 25 MB).";
  return "The file couldn't be imported. Try again in a moment.";
}

/** The plain summary after importing starred articles (SPEC section 23). */
export function starsMessage(summary: StarsSummary): string[] {
  const number = new Intl.NumberFormat("en-GB");
  const articles = (count: number) => `${number.format(count)} ${count === 1 ? "article" : "articles"}`;
  const lines = [
    summary.starred === 0
      ? "No new stars were added."
      : `Starred ${articles(summary.starred)}. ${summary.starred === 1 ? "It's in Starred, with a link" : "They're in Starred, each with a link"} to the original.`,
  ];
  if (summary.already > 0) {
    lines.push(`${articles(summary.already)} ${summary.already === 1 ? "was" : "were"} starred here already.`);
  }
  if (summary.unreadable > 0) {
    lines.push(`${articles(summary.unreadable)} couldn't be brought over, as the file gives no link to the original.`);
  }
  return lines;
}
