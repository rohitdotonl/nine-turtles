// Whole articles for the reading area: kept close at hand, so moving with j
// and k never waits, or read from this device's copies without a connection.
// An article this device keeps for reading offline opens from that copy at
// once, if the copy is the whole article (it has no pictures, which copies
// leave out), and the server's answer replaces it quietly when it comes, with
// any highlight made elsewhere since (decision 0314).
import { noConnection, whenBack } from "./connection.svelte";
import { keptArticle } from "./offline";
import { getJson, isRecord } from "./http";
import { toFullArticle, type FullArticle } from "./shapes";

// Articles already fetched, so moving back and forth with j and k never
// waits. Kept small: only the last few are needed.
const loaded = new Map<number, FullArticle>();
const loading = new Map<number, Promise<FullArticle>>();
const KEEP = 20;
/** Counts the readers this tab has had, so an answer for the last one is never kept for the next. */
let generation = 0;
/** Told when an article already shown from this device's copy has the server's answer (`onFresher`). */
const fresher = new Set<() => void>();

/** Another reader, or nobody: the articles fetched so far (with the last reader's marks) go. */
export function forgetLoaded(): void {
  generation++;
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

/** Calls `listener` whenever an article shown from this device's copy gets the server's answer. Returns how to stop. */
export function onFresher(listener: () => void): () => void {
  fresher.add(listener);
  return () => fresher.delete(listener);
}

/** The article, from the ones already here, this device's whole copy of it, or the server. */
export function readArticle(id: number): Promise<FullArticle> {
  const here = loaded.get(id);
  if (here) return Promise.resolve(here);
  const pending = loading.get(id);
  if (pending) return pending;
  const mine = generation;
  const keep = (article: FullArticle) => {
    if (mine !== generation) return;
    loaded.set(id, article);
    if (loaded.size > KEEP) loaded.delete(loaded.keys().next().value as number);
  };
  const server = fromServer(id);
  const request = new Promise<FullArticle>((resolve, reject) => {
    let shown = false;
    void wholeCopy(id).then((copy) => {
      if (!copy || shown) return;
      shown = true;
      keep(copy);
      resolve(copy);
    });
    server.then(
      (article) => {
        keep(article);
        if (shown) {
          for (const listener of fresher) listener();
        } else {
          shown = true;
          resolve(article);
        }
      },
      (problem) => {
        if (!shown) {
          shown = true;
          reject(problem);
        }
      },
    );
  }).finally(() => loading.delete(id));
  loading.set(id, request);
  return request;
}

/** The server's article, or without a connection this device's copy (words only). */
function fromServer(id: number): Promise<FullArticle> {
  return getJson(`/api/articles/${id}`).then(
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
  );
}

/** This device's copy, only if it's the whole article: a copy leaves pictures out, each a short note (`offline-image`). */
async function wholeCopy(id: number): Promise<FullArticle | undefined> {
  const copy = await keptArticle(id);
  const words = `${copy?.content ?? ""}${copy?.summary ?? ""}`;
  return copy && !words.includes("offline-image") ? copy : undefined;
}

/** Fetches an article in advance, so it shows at once when asked for. */
export function prefetch(id: number): void {
  readArticle(id).catch(() => {
    // Nothing to do: it's fetched again when actually opened.
  });
}
