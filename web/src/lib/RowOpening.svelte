<!--
  Start reading on a phone (SPEC section 7, decision 0210): where there's no reading area, the
  list's first row, when unread, is begun: under its line, its first paragraph in the reading face
  (four lines at most) and Start reading, the solid button's look, since pressing anywhere on the
  row opens it. The row is the button, and the paragraph and the button's look are hidden from
  screen readers, so they hear the row's title and line as before, with "Newest unread" above it.
-->
<script lang="ts">
  import { openingFor, type Opening } from "./leadOpening";
  import type { Article } from "./shapes";

  /** `paragraph` false: an untitled post already shows its opening words in the title's place (decision 0196). */
  let { article, paragraph = true }: { article: Article; paragraph?: boolean } = $props();

  let found = $state<Opening>();
  let shown = $derived(found?.id === article.id ? found : undefined);

  $effect(() => {
    const id = article.id;
    // An answer for an article no longer shown (the list moved on) is let go.
    void openingFor(article).then((each) => {
      if (each.id === id) found = each;
    });
  });
</script>

<!-- A look at the words, not part of the row's name: screen readers hear the row as every other. -->
{#if paragraph && shown?.opening}<span class="opening" aria-hidden="true" lang={shown.language}>{shown.opening}</span>{/if}
<span class="btn-primary start" aria-hidden="true">Start reading</span>

<style>
  .opening {
    display: -webkit-box;
    margin-top: 0.75rem;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    overflow: hidden;
    font-family: var(--font-serif);
    font-size: 1.0625rem;
    line-height: 1.6;
    color: var(--ink);
  }
  .start {
    display: inline-flex;
    margin-top: 1rem;
    font-size: var(--text-base);
  }
</style>
