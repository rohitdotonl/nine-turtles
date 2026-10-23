<!--
  The item list (SPEC section 6): each article's title, with its source and
  time in quiet small text below. No images, no site icons. It shows 50 and
  then ends; "Show older items" adds the next 50 below, and nothing above
  moves. Opening an article comes in Milestone 6.
-->
<script lang="ts">
  import { listArticles, when, type Article } from "./feeds";

  let { feedId, empty }: { feedId: number | null; empty: string } = $props();

  let articles: Article[] = $state([]);
  let older: string | null = $state(null);
  let loaded = $state(false);
  let busy = $state(false);
  let problem = $state("");
  let rows: HTMLLIElement[] = $state([]);

  async function load(before: string | null) {
    if (busy) return;
    busy = true;
    problem = "";
    const firstNew = articles.length;
    try {
      const page = await listArticles(feedId, before);
      articles = before === null ? page.articles : [...articles, ...page.articles];
      older = page.older;
      loaded = true;
    } catch {
      problem = "The articles couldn't be loaded. Try again in a moment.";
    }
    busy = false;
    // At the very end the button goes away. Rather than lose the keyboard's
    // place with it, move it to the first article just added.
    if (before !== null && older === null) queueMicrotask(() => rows[firstNew]?.focus());
  }

  load(null);
</script>

{#if loaded && articles.length === 0}
  <p>{empty}</p>
{:else if articles.length > 0}
  <ul class="-mx-6">
    {#each articles as article, index (article.id)}
      <li class="px-6 py-3" tabindex="-1" bind:this={rows[index]}>
        <p>{article.title || "Untitled"}</p>
        <p class="text-small text-muted">
          {article.feedTitle} ·
          <time datetime={new Date(article.at * 1000).toISOString()}>{when(article.at)}</time>
        </p>
      </li>
    {/each}
  </ul>
  {#if older !== null}
    <button type="button" aria-disabled={busy} onclick={() => load(older)} class="mt-4 min-h-11 rounded border border-ink px-4">
      Show older items
    </button>
  {/if}
{/if}
{#if problem}
  <p role="status" class="mt-4">{problem}</p>
{/if}
