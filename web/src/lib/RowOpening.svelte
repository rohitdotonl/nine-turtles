<!--
  Start reading on a phone (SPEC section 7, decision 0206): where there's no reading area, the
  list's first row, when unread, is begun: under its line, its first paragraph in the reading face
  (four lines at most) and Start reading, the solid button's look, since pressing anywhere on the
  row opens it (the row is the button, so screen readers hear the row as before).
-->
<script lang="ts">
  import { openingFor, type Opening } from "./leadOpening";
  import type { Article } from "./shapes";

  let { article }: { article: Article } = $props();

  let found = $state<Opening>();
  let shown = $derived(found?.id === article.id ? found : undefined);

  $effect(() => {
    void openingFor(article).then((each) => (found = each));
  });
</script>

{#if shown?.opening}<span class="opening">{shown.opening}</span>{/if}
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
