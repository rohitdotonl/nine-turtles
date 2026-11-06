<!--
  Their page's reading (SPEC section 36, decision 0211): under Write to and your note on them,
  "Lately", their three newest pieces, each one press from reading, and "Your highlights", the
  words you highlighted in their writing (the newest article first, at most 20; Notes has them
  all), each set as at an article's end: the words in the reading serif with a fine line at the
  left, "From {title} · {day}" (the title opens the article) and your note on it. Each part shows
  only when it has something. No counts, no color.
-->
<script lang="ts">
  import { getJson, isRecord } from "./http";
  import { listArticles } from "./lists";
  import NoteText from "./NoteText.svelte";
  import { toArticle, type Article } from "./shapes";
  import { when } from "./times";

  let { feed, onOpen }: { feed: number; onOpen: (article: Article) => void } = $props();

  type Highlight = { id: number; quote: string; note: string | null; article: Article };

  /** How many of their newest pieces show. */
  const LATELY = 3;

  let lately: Article[] = $state([]);
  let highlights: Highlight[] = $state([]);

  $effect(() => {
    const id = feed;
    lately = [];
    highlights = [];
    listArticles({ feed: id }, "newest", null).then(
      (page) => id === feed && (lately = page.articles.slice(0, LATELY)),
      () => undefined,
    );
    getJson(`/api/feeds/${id}/highlights`).then(
      (body) => id === feed && (highlights = toHighlights(body)),
      () => undefined,
    );
  });

  function toHighlights(body: unknown): Highlight[] {
    if (!isRecord(body) || !Array.isArray(body.highlights)) return [];
    return body.highlights.flatMap((each: unknown) =>
      isRecord(each) && typeof each.quote === "string" && isRecord(each.article)
        ? [{ id: Number(each.id), quote: each.quote, note: typeof each.note === "string" ? each.note : null, article: toArticle(each.article) }]
        : [],
    );
  }
</script>

{#if lately.length > 0}
  <section class="flex flex-col gap-2" aria-labelledby="their-lately">
    <h3 id="their-lately" class="label">Lately</h3>
    <ul class="rows">
      {#each lately as article (article.id)}
        <li>
          <button type="button" class="row" onclick={() => onOpen(article)}>
            <span class="title">{article.title || "Untitled"}</span>
            <time class="day" datetime={new Date(article.at * 1000).toISOString()}>{when(article.at)}</time>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}

{#if highlights.length > 0}
  <section class="flex flex-col gap-3" aria-labelledby="their-highlights">
    <h3 id="their-highlights" class="label">Your highlights</h3>
    <ul class="flex flex-col gap-4">
      {#each highlights as each (each.id)}
        <li class="quote">
          <p class="font-serif text-ink">{each.quote}</p>
          <p class="from">
            From <button type="button" class="text-link" onclick={() => onOpen(each.article)}>{each.article.title || "Untitled"}</button>
            · <time datetime={new Date(each.article.at * 1000).toISOString()}>{when(each.article.at)}</time>
          </p>
          {#if each.note}<div class="text-small"><NoteText note={each.note} /></div>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  /* Small spaced capitals in the muted grey, as "Your note" and an article's end name theirs. */
  .label {
    color: var(--muted);
    font-size: var(--text-meta);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  /* Rows like a book's contents: a hairline between, the title in the reading serif, its day at the right. */
  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rows li {
    border-top: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .rows li:last-child {
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .row {
    display: flex;
    width: 100%;
    min-height: 3rem;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.7rem 0;
    text-align: left;
  }
  .row:hover .title {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .title {
    font-family: var(--font-serif);
    font-size: 1.0625rem;
    line-height: 1.35;
    color: var(--ink);
  }
  .day {
    flex-shrink: 0;
    font-size: var(--text-meta);
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  /* Each highlight: its words in the reading serif, set off by a fine line at the left, as at an article's end. */
  .quote {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding-left: 0.875rem;
    border-left: 2px solid color-mix(in srgb, var(--ink) 18%, transparent);
    font-size: var(--text-base);
    line-height: 1.55;
  }
  .from {
    font-size: var(--text-meta);
    color: var(--ink-2);
  }
</style>
