// Whole articles for the reading area: kept close at hand, so moving with j
// and k never waits, or read from this device's copies without a connection.
import { noConnection, whenBack } from "./connection.svelte";
import { keptArticle } from "./offline";
import { getJson, isRecord } from "./http";
import { toFullArticle, type FullArticle } from "./shapes";

// Articles already fetched, so moving back and forth with j and k never
// waits. Kept small: only the last few are needed.
const loaded = new Map<number, FullArticle>();
const loading = new Map<number, Promise<FullArticle>>();
const KEEP = 20;

/** Another reader, or nobody: the articles fetched so far (with the last reader's marks) go. */
export function forgetLoaded(): void {
  loaded.clear();
  loading.clear();
}
/** Those opened from this device's copies, words only: fetched again in full once the connection is back. */
const fromDevice = new Set<number>();
whenBack(() => {
  for (const id of fromDevice) loaded.delete(id);
  fromDevice.clear();
});

/** The article, if it's already here, without waiting. */
export function articleNow(id: number): FullArticle | undefined {
  return loaded.get(id);
}

/** The article, from the ones already here or from the server. */
export function readArticle(id: number): Promise<FullArticle> {
  const here = loaded.get(id);
  if (here) return Promise.resolve(here);
  const pending = loading.get(id);
  if (pending) return pending;
  const request = getJson(`/api/articles/${id}`)
    .then(
      (body) => {
        if (!isRecord(body) || !isRecord(body.article)) throw new Error("nine turtles sent an unexpected answer");
        return toFullArticle(body.article);
      },
      async (problem) => {
        const kept = noConnection(problem) ? await keptArticle(id) : undefined;
        if (!kept) throw problem;
        fromDevice.add(id);
        return kept;
      },
    )
    .then((article) => {
      loaded.set(id, article);
      if (loaded.size > KEEP) loaded.delete(loaded.keys().next().value as number);
      return article;
    })
    .finally(() => loading.delete(id));
  loading.set(id, request);
  return request;
}

/** Fetches an article in advance, so it shows at once when asked for. */
export function prefetch(id: number): void {
  readArticle(id).catch(() => {
    // Nothing to do: it's fetched again when actually opened.
  });
}
