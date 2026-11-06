// Following several of a site's feeds at once (SPEC section 3, decision
// 0199): Add a feed's list of the feeds a site offers has a tick box on each,
// and Follow follows every ticked one, one after another. Those followed
// together become one person (a blog and its podcast); this sorts out what
// happened, so the screen can say it.
import { explain, type AddResult, type Choice, type Problem } from "./feeds";
import type { Feed } from "./shapes";

export type Together = {
  /** Followed now, in the list's order, each with its newest title. */
  added: { feed: Feed; latest?: string }[];
  /** One that was followed already, to go to when nothing new was followed. */
  already?: number;
  /** The first problem, to say when nothing could be followed. */
  problem?: Problem;
  /** Names the ticked feeds that couldn't be followed, when others were. */
  note?: string;
};

/** What following `urls` (in order, answered by `results`) came to; `choices` name them. */
export function followedTogether(urls: string[], results: AddResult[], choices: Choice[]): Together {
  const together: Together = { added: [] };
  const failed: string[] = [];
  results.forEach((result, index) => {
    if (result.kind === "added") together.added.push({ feed: result.feed, ...(result.latest ? { latest: result.latest } : {}) });
    else if (result.kind === "already") together.already ??= result.feedId;
    else {
      const url = urls[index];
      failed.push(choices.find((choice) => choice.url === url)?.title || url || "");
      if (result.kind === "problem") together.problem ??= result.reason;
    }
  });
  if (together.added.length > 0 && failed.length > 0) together.note = couldNot(failed, together.problem);
  return together;
}

/** "Comments couldn't be followed: That site didn't answer. Try again later." */
function couldNot(titles: string[], problem: Problem | undefined): string {
  const names = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
  return `${names} couldn't be followed${problem ? `: ${explain(problem)}` : "."}`;
}
