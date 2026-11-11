<!--
  Their page's reading (SPEC section 36, decision 0211): under Write to and your note on them,
  "Your highlights", the words you highlighted in their writing (the newest article first, at
  most 20; Notes has them all), each set as at an article's end: the words in the reading serif
  with a fine line at the left, "From {title} · {day}" (the title opens the article) and your
  note on it. Its label shows at once, with the empty state's room kept while they load, so
  nothing below moves; with none, "Nothing highlighted yet." and how it fills (decision 0254);
  when they can't be loaded, one quiet line says so rather than letting them seem gone. (Lately, their three newest pieces, went in
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
  let loaded = $state(false);

  $effect(() => {
    const id = feed;
    highlights = [];
    failed = false;
    loaded = false;
    getJson(`/api/feeds/${id}/highlights`).then(
      (body) => {
        if (id !== feed) return;
        highlights = toHighlights(body);
        loaded = true;
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
{:else}
  <section class="flex flex-col gap-3" aria-labelledby="their-highlights">
    <h3 id="their-highlights" class="label">Your highlights</h3>
    {#if !loaded}
      <!-- While they load (a moment), the room the empty state takes, so what's below doesn't move when nothing comes. -->
      <div class="waiting" aria-hidden="true"></div>
    {:else if highlights.length === 0}
      <!-- Nothing yet: the fact, then how it fills (BRAND.md → "Empty screens"). -->
      <div class="waiting flex flex-col gap-2">
        <p class="font-serif text-ink-2">Nothing highlighted yet.</p>
        <p class="text-meta text-muted">Words you highlight in their writing gather here.</p>
      </div>
    {:else}
      <ul class="flex flex-col gap-8">
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
    {/if}
  </section>
{/if}

<style>
  /* Each highlight: its words in the reading serif, set off by a fine line at the left, as at an article's end. */
  /* Their words, where the eye rests: the reading serif a step larger than the interface around it. */
  /* The empty state's own height, kept while loading. */
  .waiting {
    min-height: 3.5rem;
  }
  .quote {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-left: 1.25rem;
    border-left: 2px solid var(--strong);
    font-size: var(--text-large);
    line-height: 1.5;
  }
  .from {
    font-size: var(--text-meta);
    line-height: 1.5;
    color: var(--ink-2);
  }
  /* The title reads as part of the line; its 44px to touch reaches above and below without spacing the lines apart. */
  .from :global(.text-link) {
    position: relative;
    display: inline;
    min-height: 0;
    text-align: left;
  }
  .from :global(.text-link)::after {
    content: "";
    position: absolute;
    inset: -0.75rem -0.25rem;
  }
  .quote :global(.text-meta) {
    color: var(--ink);
  }
</style>
