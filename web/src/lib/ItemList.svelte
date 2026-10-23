<!--
  The item list (SPEC sections 6, 8 and 9): each article's title, with its
  source and time in quiet small text below. No images, no site icons.
  Unread titles are full strength and semibold, read ones muted and regular,
  starred ones carry a small star: each state shows without color too.

  It shows 50 and then ends; "Show older items" adds the next 50 below, and
  nothing above moves. Choosing an article (a click, Enter, or j and k)
  selects it and the reading area shows it (SPEC section 7); the next one is
  fetched in advance.

  Above the list: "Mark all as read", which marks only the articles listed
  here, and the reserved line where "Marked 23 items as read · Undo" appears
  (and "New items · press r" in Milestone 8), so nothing shifts. Every mark
  shows at once and is saved behind; if saving fails, the line says so and
  the mark is taken back (SPEC section 25). Articles read in the Unread view
  stay where they are, greyed, until you leave it.
-->
<script lang="ts">
  import {
    listArticles,
    markedAllMessage,
    markRead,
    markStarred,
    prefetch,
    when,
    type Article,
    type Order,
    type Source,
  } from "./feeds";

  let {
    source,
    order,
    empty,
    selected = $bindable(),
    onChoose,
    onUnreadChange,
  }: {
    source: Source;
    order: Order;
    empty: string;
    selected: Article | undefined;
    /** A row was clicked or Enter was pressed on it. `byKeyboard` tells which. */
    onChoose: (byKeyboard: boolean) => void;
    /** A feed's unread count went up or down by `change`, for the sidebar. */
    onUnreadChange: (feedId: number, change: number) => void;
  } = $props();

  let articles: Article[] = $state([]);
  let next: string | null = $state(null);
  let loaded = $state(false);
  let busy = $state(false);
  let problem = $state("");
  let rows: HTMLButtonElement[] = $state([]);
  let markAllButton: HTMLButtonElement | undefined = $state();

  /** The reserved line above the list, and what Undo would do, if anything. */
  let line = $state("");
  let undoLast: (() => void) | undefined = $state();

  let selectedIndex = $derived(selected ? articles.findIndex((article) => article.id === selected?.id) : -1);

  async function load(after: string | null) {
    if (busy) return;
    busy = true;
    problem = "";
    const firstNew = articles.length;
    try {
      const page = await listArticles(source, order, after);
      articles = after === null ? page.articles : [...articles, ...page.articles];
      next = page.next;
      loaded = true;
    } catch {
      problem = "The articles couldn't be loaded. Try again in a moment.";
    }
    busy = false;
    // At the very end the button goes away. Rather than lose the keyboard's
    // place with it, move it to the first article just added.
    if (after !== null && next === null) queueMicrotask(() => rows[firstNew]?.focus());
  }

  function select(index: number) {
    const article = articles[index];
    if (!article) return;
    selected = article;
    prefetch(article.id);
    const following = articles[index + 1];
    if (following) prefetch(following.id);
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

  /**
   * Sets read or unread on the screen at once, keeps the sidebar's counts
   * in step, then saves. If saving fails, the screen goes back and says so.
   */
  function setRead(changing: Article[], read: boolean) {
    const changed = changing.filter((article) => article.read !== read);
    if (changed.length === 0) return;
    for (const article of changed) {
      article.read = read;
      onUnreadChange(article.feedId, read ? -1 : 1);
    }
    markRead(
      changed.map((article) => article.id),
      read,
    ).catch(() => {
      for (const article of changed) {
        article.read = !read;
        onUnreadChange(article.feedId, read ? 1 : -1);
      }
      say("That couldn't be saved. Try again.");
    });
  }

  function setStarred(article: Article, starred: boolean) {
    article.starred = starred;
    markStarred([article.id], starred).catch(() => {
      article.starred = !starred;
      say(starred ? "The star couldn't be saved." : "The star couldn't be removed.");
    });
  }

  /** The line says something that has nothing to undo. */
  function say(message: string) {
    line = message;
    undoLast = undefined;
  }

  /** An undoable action happened: the line says what, and Undo reverses it. */
  function did(message: string, reverse: () => void) {
    line = message;
    undoLast = reverse;
  }

  /** The reading area showed this article: it counts as read (not an undoable action). */
  export function shown(article: Article) {
    setRead([article], true);
  }

  /** `m` and "Mark unread": the selected article is unread again. */
  export function markUnread() {
    const article = selected;
    if (!article || !article.read) return;
    setRead([article], false);
    did("Marked as unread", () => setRead([article], true));
  }

  /** `s` and the star control: stars or unstars the selected article. */
  export function toggleStar() {
    const article = selected;
    if (!article) return;
    const starred = !article.starred;
    setStarred(article, starred);
    did(starred ? "Starred" : "Unstarred", () => setStarred(article, !starred));
  }

  /** `Shift+A` and "Mark all as read": only the articles listed here, never ones not shown yet. */
  export function markAllRead() {
    const unread = articles.filter((article) => !article.read);
    if (unread.length === 0) {
      say(markedAllMessage(0));
      return;
    }
    setRead(unread, true);
    did(markedAllMessage(unread.length), () => setRead(unread, false));
  }

  /** `u` and Undo: reverses the last undoable action, once. */
  export function undo(): boolean {
    const reverse = undoLast;
    if (!reverse) return false;
    reverse();
    line = "Undone.";
    undoLast = undefined;
    return true;
  }

  function undoByButton() {
    undo();
    // The button is gone; keep the keyboard's place nearby.
    if (selectedIndex !== -1) focusSelected();
    else markAllButton?.focus();
  }

  function arrows(event: KeyboardEvent) {
    // The arrow keys work like j and k while the keyboard is in the list.
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (move(event.key === "ArrowDown" ? 1 : -1)) focusSelected();
  }

  load(null);
</script>

{#if articles.length > 0}
  <button type="button" bind:this={markAllButton} onclick={markAllRead} class="mt-2 min-h-11 rounded border border-ink px-4">
    Mark all as read
  </button>
{/if}
<!-- The reserved line: always this tall, so nothing below moves when it fills. -->
<p class="flex min-h-11 flex-wrap items-center gap-x-1 text-small">
  <span role="status">{line}</span>
  {#if undoLast}
    <span aria-hidden="true">·</span>
    <button type="button" onclick={undoByButton} class="min-h-11 px-1 underline underline-offset-4">Undo</button>
  {/if}
</p>

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
            "item-row block w-full border-l-4 py-3 pr-6 pl-5 text-left",
            current ? "border-accent bg-tint-list" : "border-transparent",
          ]}
        >
          <span class={["block", article.read ? "text-muted" : "font-semibold"]}
            >{article.title || "Untitled"}{#if !article.read}<span class="sr-only">, unread</span>{/if}</span
          >
          <span class="block text-small text-muted">
            {#if article.starred}
              <svg aria-hidden="true" class="star" width="12" height="12" viewBox="0 0 12 12">
                <path d="M6 0.8l1.55 3.3 3.6.42-2.66 2.47.7 3.56L6 8.8 2.81 10.55l.7-3.56L.85 4.52l3.6-.42z" fill="currentColor" />
              </svg><span class="sr-only">Starred, </span>
            {/if}
            {article.feedTitle} ·
            <time datetime={new Date(article.at * 1000).toISOString()}>{when(article.at)}</time>
          </span>
        </button>
      </li>
    {/each}
  </ul>
  {#if next !== null}
    <button type="button" aria-disabled={busy} onclick={() => load(next)} class="mt-4 min-h-11 rounded border border-ink px-4">
      {order === "oldest" ? "Show newer items" : "Show older items"}
    </button>
  {/if}
{/if}
{#if problem}
  <p role="status" class="mt-4">{problem}</p>
{/if}

<style>
  .star {
    display: inline;
    vertical-align: -1px;
    margin-right: 0.25rem;
  }
</style>
