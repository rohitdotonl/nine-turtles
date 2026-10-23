<!--
  The item list (SPEC section 6): each article's title, with its source and
  time in quiet small text below. No images, no site icons. It shows 50 and
  then ends; "Show older items" adds the next 50 below, and nothing above
  moves. Choosing an article (a click, Enter, or j and k) selects it and the
  reading area shows it (SPEC section 7); the next one is fetched in advance.
-->
<script lang="ts">
  import { listArticles, prefetch, when, type Article } from "./feeds";

  let {
    feedId,
    empty,
    selected = $bindable(),
    onChoose,
  }: {
    feedId: number | null;
    empty: string;
    selected: Article | undefined;
    /** A row was clicked or Enter was pressed on it. `byKeyboard` tells which. */
    onChoose: (byKeyboard: boolean) => void;
  } = $props();

  let articles: Article[] = $state([]);
  let older: string | null = $state(null);
  let loaded = $state(false);
  let busy = $state(false);
  let problem = $state("");
  let rows: HTMLButtonElement[] = $state([]);

  let selectedIndex = $derived(selected ? articles.findIndex((article) => article.id === selected?.id) : -1);

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

  function select(index: number) {
    const article = articles[index];
    if (!article) return;
    selected = article;
    prefetch(article.id);
    const next = articles[index + 1];
    if (next) prefetch(next.id);
  }

  /**
   * Selects the next (1) or previous (-1) article; the first if none is
   * selected yet. Returns false at either end of the list: it never loads
   * more on its own (DESIGN.md → "The list has an end").
   */
  export function move(step: 1 | -1): boolean {
    const index = selectedIndex === -1 ? 0 : selectedIndex + step;
    if (index < 0 || index >= articles.length) return false;
    select(index);
    return true;
  }

  /** Moves the keyboard's place to the selected article, scrolled into view if needed. */
  export function focusSelected() {
    queueMicrotask(() => rows[selectedIndex]?.focus());
  }

  function arrows(event: KeyboardEvent) {
    // The arrow keys work like j and k while the keyboard is in the list.
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (move(event.key === "ArrowDown" ? 1 : -1)) focusSelected();
  }

  load(null);
</script>

{#if loaded && articles.length === 0}
  <p>{empty}</p>
{:else if articles.length > 0}
  <ul class="-mx-6">
    {#each articles as article, index (article.id)}
      {@const current = index === selectedIndex}
      <li>
        <!-- Only one row is a Tab stop (the selected one, or the first); the others are reached with j, k or the arrows. -->
        <button
          type="button"
          bind:this={rows[index]}
          tabindex={current || (selectedIndex === -1 && index === 0) ? 0 : -1}
          aria-current={current ? "true" : undefined}
          onclick={(event) => {
            select(index);
            // A click made with Enter has no mouse position.
            onChoose(event.detail === 0);
          }}
          onkeydown={arrows}
          class={[
            "block w-full border-l-4 py-3 pr-6 pl-5 text-left",
            current ? "border-accent bg-tint-list" : "border-transparent",
          ]}
        >
          <span class="block">{article.title || "Untitled"}</span>
          <span class="block text-small text-muted">
            {article.feedTitle} ·
            <time datetime={new Date(article.at * 1000).toISOString()}>{when(article.at)}</time>
          </span>
        </button>
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
