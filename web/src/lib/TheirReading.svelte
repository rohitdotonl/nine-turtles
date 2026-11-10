<!--
  Their page's reading (SPEC section 36, decision 0211): under Write to and your note on them,
  "Your highlights", the words you highlighted in their writing (the newest article first, at
  most 20; Notes has them all), each set as at an article's end: the words in the reading serif
  with a fine line at the left, "From {title} · {day}" (the title opens the article) and your
  note on it. It shows only when there is something; when they can't be loaded, one quiet line
  says so rather than letting them seem gone. (Lately, their three newest pieces, went in
  decision 0215: their list already shows them.) An untitled piece shows its opening words, as
  a list does (decision 0196). No counts, no color.
-->
<script lang="ts">
  import { getJson, isRecord } from "./http";
  import NoteText from "./NoteText.svelte";
  import { toArticle, untitledOpening, type Article } from "./shapes";
  import { exactly, when } from "./times";

  let { feed, onOpen }: { feed: number; onOpen: (article: Article) => void } = $props();

  type Highlight = { id: number; quote: string; note: string | null; article: Article };

  let highlights: Highlight[] = $state([]);
  let failed = $state(false);

  $effect(() => {
    const id = feed;
    highlights = [];
    failed = false;
    getJson(`/api/feeds/${id}/highlights`).then(
      (body) => {
        if (id !== feed) return;
        highlights = toHighlights(body);
      },
      () => id === feed && (failed = true),
    );
  });

  /** Its title, or an untitled piece's opening words. */
  const titleOf = (article: Article) => untitledOpening(article) ?? article.title;

  function toHighlights(body: unknown): Highlight[] {
    if (!isRecord(body) || !Array.isArray(body.highlights)) return [];
    return body.highlights.flatMap((each: unknown) =>
      isRecord(each) && typeof each.quote === "string" && isRecord(each.article)
        ? [{ id: Number(each.id), quote: each.quote, note: typeof each.note === "string" ? each.note : null, article: toArticle(each.article) }]
        : [],
    );
  }
</script>

{#if failed}
  <p class="text-meta text-ink-2">Your highlights from their writing couldn't be loaded. Open the page again to try once more.</p>
{/if}

{#if highlights.length > 0}
  <section class="flex flex-col gap-3" aria-labelledby="their-highlights">
    <h3 id="their-highlights" class="label">Your highlights</h3>
    <ul class="flex flex-col gap-4">
      {#each highlights as each (each.id)}
        <li class="quote">
          <p class="font-serif text-ink">{each.quote}</p>
          <p class="from">
            From <button type="button" class="text-link" onclick={() => onOpen(each.article)}>{titleOf(each.article)}</button>
            · <time datetime={new Date(each.article.at * 1000).toISOString()} title={exactly(each.article.at)}>{when(each.article.at)}</time>
          </p>
          {#if each.note}<div class="text-meta"><NoteText note={each.note} /></div>{/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  /* Each highlight: its words in the reading serif, set off by a fine line at the left, as at an article's end. */
  .quote {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-left: 1rem;
    border-left: 2px solid var(--strong);
    font-size: var(--text-base);
    line-height: 1.55;
  }
  .from {
    font-size: var(--text-meta);
    color: var(--ink-2);
  }
</style>
