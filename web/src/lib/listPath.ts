// Where a list's pages are on the server: for the lists themselves (lists.ts)
// and for asking for the first one as the app opens (early.ts).
import type { Order } from "./reading";
import type { Source } from "./shapes";

/** A list's place as the server's query: a view, a feed, a folder or a search. */
export function sourceQuery(source: Source): URLSearchParams {
  const query = new URLSearchParams();
  if ("search" in source) for (const [name, value] of Object.entries(source.search)) query.set(name, value);
  else if ("feed" in source) query.set("feed", String(source.feed));
  else if ("folder" in source) query.set("folder", String(source.folder));
  else query.set("view", source.view);
  return query;
}

/** The server's address for a page of a list. */
export function listPath(source: Source, order: Order, after: string | null): string {
  const query = sourceQuery(source);
  query.set("order", order);
  if (after !== null) query.set("after", after);
  return `/api/${"search" in source ? "search" : "articles"}?${query}`;
}
