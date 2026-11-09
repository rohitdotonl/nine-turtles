<!--
  Start reading (SPEC section 7, decision 0210): in the empty reading area, the newest unread
  article (the oldest, with Oldest first) is already begun, set as the article is: a small muted
  line ("Newest unread"), its title, its byline and its first paragraph, then one solid button,
  Start reading, that opens it. Nothing counts as read until it's opened. With no reading area (a
  phone), the list's first row is begun instead (`RowOpening`).
-->
<script lang="ts">
  import { openingFor, type Opening } from "./leadOpening";
  import type { Order } from "./reading";
  import type { Article } from "./shapes";
  import { when } from "./times";

  let { article, order, onOpen }: { article: Article; order: Order; onOpen: () => void } = $props();

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

<div class="lead">
  <p class="label">{order === "oldest" ? "Oldest" : "Newest"} unread</p>
  <h2 class="article-title" lang={shown?.language}>{article.title || "Untitled"}</h2>
  <p class="article-byline">
    <span class="publisher">{article.feedTitle}</span>{#if shown?.author}&nbsp;· {shown.author}{/if}
    · <time datetime={new Date(article.at * 1000).toISOString()}>{when(article.at)}</time>
  </p>
  {#if shown?.opening}<p class="opening" lang={shown?.language}>{shown.opening}</p>{/if}
  <button type="button" class="btn-primary start" onclick={onOpen}>Start reading</button>
</div>

<!--
  Set as the article is (its title and byline); its first paragraph in the reading face cut after
  six lines, then the one solid button, 32px below. A small muted label 12px above the title says
  which it is. No accent and no picture.
-->
<style>
  .lead {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .label {
    margin-bottom: 0.75rem;
    font-family: var(--font-sans);
    font-size: var(--text-small);
    line-height: 1.45;
    color: var(--muted);
  }
  .opening {
    display: -webkit-box;
    margin-top: 1em;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    overflow: hidden;
  }
  .start {
    margin-top: 2rem;
    font-family: var(--font-sans);
    font-size: var(--text-base);
  }
</style>
