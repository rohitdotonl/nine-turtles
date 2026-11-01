// "Follow this person?" (SPEC section 3, decision 0132): a page shared to
// nine turtles (a share menu, a Shortcuts shortcut or a bookmark, decision
// 0104) is one question, "Follow <name>?", and one press. This looks at the
// page through the feed finder's lookup without following anything, names
// who wrote it, and says problems in words that never mention feeds or RSS.
import { api } from "./updates.svelte";
import { isRecord } from "./http";
import { PROBLEMS, explain, type Choice, type Problem } from "./feeds";

/** Who a shared page is by, as far as its feed says. */
export type Person = {
  /** The feeds the page names; Follow follows the first, the site's own. */
  choices: Choice[];
  /** The name the feed gives itself (usually the writer's or their site's), or empty. */
  name: string;
  /** Their website, if the feed names it. */
  site: string;
};

/** What looking at a shared page found: the person, a problem to say, or nothing to say ("quiet"). */
export type Looked = ({ kind: "found" } & Person) | { kind: "problem"; reason: Problem } | { kind: "quiet" };

/**
 * Looks at a shared page without following anything (decision 0104): the
 * feed finder's lookup (decision 0099). When the finder is busy, or can't be
 * reached, it says nothing: Follow still works, through the ordinary add.
 */
export async function lookAt(address: string): Promise<Looked> {
  let response: Response;
  try {
    response = await api(`/api/find-feeds?address=${encodeURIComponent(address)}`, { cache: "no-store" });
  } catch {
    return { kind: "quiet" };
  }
  return readLooked(await response.json().catch(() => null));
}

/** The finder's answer, read into what the question shows. */
export function readLooked(body: unknown): Looked {
  if (!isRecord(body)) return { kind: "quiet" };
  if (Array.isArray(body.feeds)) {
    const choices = body.feeds.filter(isRecord).map((choice) => ({
      title: String(choice.title ?? ""),
      url: String(choice.url ?? ""),
    }));
    if (choices.length === 0) return { kind: "problem", reason: "no-feed" };
    const preview = isRecord(body.preview) ? body.preview : {};
    return {
      kind: "found",
      choices,
      name: plain(preview.title) || plain(choices[0]?.title),
      site: plain(preview.site),
    };
  }
  const reason = PROBLEMS.find((problem) => problem === body.error);
  return reason ? { kind: "problem", reason } : { kind: "quiet" };
}

/** Text with its runs of spaces and line breaks made single spaces. */
function plain(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** The sheet's title: the question, with the person's name once it's known. */
export function followTitle(name: string): string {
  return name ? `Follow ${name}?` : "Follow this person?";
}

/** A web address's site, as a person says it ("example.com"), or the address itself when it isn't one. */
export function siteOf(address: string): string {
  return address.replace(/^https?:\/\/(www\.)?/i, "").replace(/[/?#].*$/s, "");
}

/** Why following didn't happen, in plain words with no "feed" or "RSS" in them: Add feed's own, where those have none. */
export function sayProblem(reason: Problem): string {
  switch (reason) {
    case "too-big":
    case "no-feed":
      return "This site doesn't offer a way to follow it from here.";
    case "too-many":
      return "You already follow 1,000 sites, as many as one reader can. Unsubscribe from one to follow another.";
    case "plan-ended":
      return "Your free trial or plan has ended. Choose a plan in Settings to follow someone new.";
    case "offline":
      return "Following needs a connection. Try again once you're back online.";
    default:
      return explain(reason);
  }
}
