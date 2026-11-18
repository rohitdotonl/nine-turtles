<!--
  The words of one row of the Notes list (SPEC section 42, decision 0308),
  under the name of the person who wrote it: the reader's marks on the
  article, newest first, then its title, quiet. A highlight is the marker
  icon and the words in the reading serif, with the note on them (the page
  icon) under it; the note on the whole article is the page icon and the
  note. No date: the list is by person, and by the newest mark. Screen
  readers hear "Highlighted" and "Your note" where the icons are. The row
  itself, a button that opens the article, is `ItemRow.svelte`'s.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { untitledOpening, type Article, type Mark } from "./shapes";

  let { article, marks, current }: { article: Article; marks: Mark[]; current: boolean } = $props();
</script>

<span class="row-marks">
  {#each marks as mark, index (index)}
    {#if mark.quote !== null}
      <span class="mark-line"><span class="mark-icon" aria-hidden="true"><Icon name="highlight" /></span><span class="sr-only">{"Highlighted: "}</span><bdi class="mark-quote font-serif text-(length:--row-title-size) leading-(--row-title-line)">{mark.quote}</bdi><span class="sr-only">{". "}</span></span>
    {/if}
    {#if mark.note !== null}
      <span class="mark-line"><span class="mark-icon" aria-hidden="true"><Icon name="note" /></span><span class="sr-only">{"Your note: "}</span><bdi class="mark-note">{mark.note}</bdi><span class="sr-only">{". "}</span></span>
    {/if}
  {/each}
  <!-- The article it's in, quiet, on the words' edge (past an icon's room): the selected row's a step stronger. -->
  <span class="mark-line"><span class="mark-icon invisible" aria-hidden="true"><Icon name="note" /></span><span class={["mark-from", current ? "text-ink-2" : "text-muted"]}><span class="sr-only">{"In "}</span><bdi>{untitledOpening(article) ?? article.title}</bdi></span></span>
</span>

<style>
  /* The marks, a little apart, then the title close under the last; the whole width of the row. */
  .row-marks {
    display: flex;
    flex: 1 1 100%;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  .mark-line {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-width: 0;
  }
  /* The icon sits on the first line of its words, in the second ink. */
  .mark-icon {
    flex-shrink: 0;
    padding-top: 0.2em;
    color: var(--ink-2);
  }
  /* Their words, where the eye rests: the reading serif, as a row's title is; four lines at most. */
  .mark-quote {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    overflow: hidden;
    overflow-wrap: anywhere;
    color: var(--ink);
  }
  /* The reader's own words: the interface type, a step smaller, three lines at most. */
  .mark-note {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
    overflow-wrap: anywhere;
    white-space: pre-line;
    font-size: var(--text-base);
    line-height: 1.5;
    color: var(--ink-2);
  }
  /* The title, one line, ending in "…". */
  .mark-from {
    display: block;
    min-width: 0;
    overflow: hidden;
    font-size: var(--text-meta);
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
