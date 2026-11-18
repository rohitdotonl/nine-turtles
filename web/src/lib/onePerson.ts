// "One person?" (SPEC section 36, decision 0308): two follows that share one
// website, asked about once. The server finds them (`writers/alike.rs`);
// Join them is "+ Add a source"'s join, and Keep apart is remembered there.

import { refused } from "./feeds";
import { getJson, isRecord, sendChange } from "./http";

/** Two follows on one website: the one whose name they'd keep first. */
export type Alike = {
  feeds: [number, number];
  names: [string, string];
  site: string;
};

/** Every pair still to ask about, in the order they were followed; none if they can't be read. */
export async function listAlike(): Promise<Alike[]> {
  try {
    const body = await getJson("/api/writers/alike");
    const pairs = isRecord(body) && Array.isArray(body.pairs) ? body.pairs : [];
    return pairs.filter(isRecord).map((pair) => ({
      feeds: [
        Number((pair.feeds as unknown[])[0]),
        Number((pair.feeds as unknown[])[1]),
      ],
      names: [
        String((pair.names as unknown[])[0] ?? ""),
        String((pair.names as unknown[])[1] ?? ""),
      ],
      site: String(pair.site ?? ""),
    }));
  } catch {
    // Only a question: with no answer it isn't asked.
    return [];
  }
}

/** The pair, if any, that a place just followed is part of. */
export function pairWith(pairs: Alike[], feed: number): Alike | undefined {
  return pairs.find((pair) => pair.feeds.includes(feed));
}

/** Keep apart: they're never asked about again. Answers why, if it couldn't be kept. */
export async function keepApart(pair: Alike): Promise<string | undefined> {
  const { refusal } = await sendChange(
    "/api/writers/apart",
    { feeds: pair.feeds },
    [],
  );
  return refusal && refused(refusal, "feed");
}
