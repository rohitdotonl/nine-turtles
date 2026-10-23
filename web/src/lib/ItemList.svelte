<!--
  The item list (SPEC sections 6, 8 and 9): each article's title, with its
  source and time in quiet small text below. No images, no site icons.
  Unread titles are full strength and semibold, read ones muted and regular,
  starred ones carry a small star: each state shows without color too.

  It shows 50 and then ends; "Show older items" adds the next 50 below, and
  nothing above moves. Choosing an article (a click, Enter, or j and k)
  selects it and the reading area shows it (SPEC section 7); the next one is
  fetched in advance.

  Above the list: Refresh and "Mark all as read", which marks only the
  articles listed here, then the reserved lines where "New items · press r"
  and "Marked 23 items as read · Undo" appear, so nothing shifts. Every mark
  shows at once and is saved behind; if saving fails, the line says so and
  the mark is taken back (SPEC section 25). Articles read in the Unread view
  stay where they are, greyed, until you leave it or press r.

  Unsubscribing and deleting a folder happen elsewhere, then lead here: the
  list arrives with their `notice` already in the line, Undo included.

  The list never changes on its own (SPEC section 13). Every minute it asks
  the server whether articles have arrived for it; if so, it says "New
  items" and waits. `r` or Refresh loads it again, instantly, since the
  server fetched them already.
-->
<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import {
    listArticles,
    markedAllMessage,
    markRead,
    markStarred,
    newItemsMessage,
    newItemsWaiting,
    prefetch,
    when,
    type Article,
    type Notice,
    type Order,
    type Source,
  } from "./feeds";
  import { boldParts } from "./search";
  import { STRANDED_MESSAGE, updates } from "./updates.svelte";

  let {
    source,
    order,
    empty,
    bold = [],
    notice,
    selected = $bindable(),
    onChoose,
    onUnreadChange,
    onRefresh,
    refreshInTopBar = false,
  }: {
    source: Source;
    order: Order;
    empty: string;
    /** Searched words: words in titles starting with one are shown in bold (SPEC section 14). */
    bold?: string[];
    /** Something done just before arriving, with its Undo. */
    notice?: Notice;
    selected: Article | undefined;
    /** A row was clicked or Enter was pressed on it. `byKeyboard` tells which. */
    onChoose: (byKeyboard: boolean) => void;
    /** A feed's unread count went up or down by `change`, for the sidebar. */
    onUnreadChange: (feedId: number, change: number) => void;
    /** The reader asked for new items; the sidebar's counts load again too. */
    onRefresh: () => void;
    /** On a phone, Refresh sits in the top bar instead (SPEC section 13), so there's only ever one. */
    refreshInTopBar?: boolean;
  } = $props();

  /** How often the list asks whether new items are waiting. */
  const ASK_EVERY_MS = 60_000;

  let articles: Article[] = $state([]);
  let next: string | null = $state(null);
  let loaded = $state(false);
  let busy = $state(false);
  let problem = $state("");
  let rows: HTMLButtonElement[] = $state([]);
  let markAllButton: HTMLButtonElement | undefined = $state();
  /** The newest article's number when the list was loaded, and whether anything has arrived since. */
  let latest = 0;
  let newWaiting = $state(false);
  // Touch screens have no r key; they're told to tap Refresh (same test as the keyboard hint).
  const touch = matchMedia("(hover: none) and (pointer: coarse)").matches;

  /** The reserved line above the list, and what Undo would do, if anything. */
  let line = $state("");
  let undoLast: (() => void) | undefined = $state();
  // The notice is read once, when the list opens.
  untrack(() => {
    if (!notice) return;
    const { message, undo } = notice;
    line = message;
    if (undo) {
      undoLast = () => {
        undo().then((problem) => {
          if (problem) say(problem);
        });
      };
    }
  });

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
      if (after === null) latest = page.latest;
      loaded = true;
    } catch {
      problem = "The articles couldn't be loaded. Try again in a moment.";
    }
    busy = false;
    // At the very end the button goes away. Rather than lose the keyboard's
    // place with it, move it to the first article just added.
    if (after !== null && next === null) queueMicrotask(() => rows[firstNew]?.focus());
  }

  /**
   * `r` and Refresh: loads the list again from the top, with what arrived in
   * the background, and the sidebar's counts with it. Articles still listed
   * keep their place in memory, so the selected one and Undo carry on. An
   * article no longer listed (read, in Unread) isn't selected in the list any
   * more, so `j` starts again from the top, as the list does.
   */
  export async function refresh() {
    if (busy) return;
    busy = true;
    problem = "";
    const focusWasInList = rows.some((row) => row === document.activeElement);
    onRefresh();
    try {
      const page = await listArticles(source, order, null);
      const kept = new Map(articles.map((article) => [article.id, article]));
      articles = page.articles.map((fresh) => {
        const old = kept.get(fresh.id);
        if (!old) return fresh;
        Object.assign(old, fresh);
        return old;
      });
      next = page.next;
      latest = page.latest;
      newWaiting = false;
      loaded = true;
    } catch {
      problem = "The articles couldn't be loaded. Try again in a moment.";
    }
    busy = false;
    // If the keyboard was on a row that's gone (read, in Unread), it moves to
    // the selected row, or the first, rather than being lost.
    if (focusWasInList && !rows.some((row) => row === document.activeElement)) {
      queueMicrotask(() => (rows[selectedIndex] ?? rows[0])?.focus());
    }
  }

  /** Asks the server, quietly, whether new items are waiting for this list. */
  async function askForNew() {
    if (!loaded || newWaiting || busy || document.hidden) return;
    try {
      newWaiting = await newItemsWaiting(source, latest);
    } catch {
      // Nothing to say: it asks again in a minute.
    }
  }

  onMount(() => {
    const asking = setInterval(askForNew, ASK_EVERY_MS);
    return () => clearInterval(asking);
  });

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

  /** Whether `move(step)` has an article to move to; on a phone, the article's Previous and Next say so. */
  export function canMove(step: 1 | -1): boolean {
    const index = selectedIndex === -1 ? 0 : selectedIndex + step;
    return index >= 0 && index < articles.length;
  }

  /** Moves the keyboard's place to the selected article, scrolled into view if needed. */
  export function focusSelected() {
    queueMicrotask(() => rows[selectedIndex]?.focus());
  }

  // What the server last confirmed for each mark, and the newest save sent
  // for it. When a save fails, the mark goes back to what the server has,
  // but only if no later save for the same mark is still on its way: that
  // one decides. So a failure never takes back a later action.
  const confirmed = new Map<string, boolean>();
  const newest = new Map<string, number>();
  let saves = 0;

  /** Remembers a mark as the server has it, the first time it's seen. */
  function known(key: string, value: boolean) {
    if (!confirmed.has(key)) confirmed.set(key, value);
  }

  /**
   * Saves one mark for some articles. `put` sets it on the screen (and keeps
   * the sidebar's counts in step). If saving fails, each article whose mark
   * no later save will settle goes back to what the server has, and the
   * line says `failed`.
   */
  function save(
    field: "read" | "starred",
    changed: Article[],
    value: boolean,
    send: (ids: number[], value: boolean) => Promise<void>,
    put: (article: Article, value: boolean) => void,
    failed: string,
  ) {
    const token = ++saves;
    for (const article of changed) {
      const key = `${field}:${article.id}`;
      known(key, article[field]);
      newest.set(key, token);
      put(article, value);
    }
    send(
      changed.map((article) => article.id),
      value,
    ).then(
      () => {
        for (const article of changed) confirmed.set(`${field}:${article.id}`, value);
      },
      () => {
        let takenBack = false;
        for (const article of changed) {
          const key = `${field}:${article.id}`;
          if (newest.get(key) !== token) continue;
          const server = confirmed.get(key) ?? !value;
          if (article[field] !== server) {
            put(article, server);
            takenBack = true;
          }
        }
        if (takenBack) say(failed);
      },
    );
  }

  /** Sets read or unread on the screen at once, then saves. */
  function setRead(changing: Article[], read: boolean, failed = "That couldn't be saved, so it was taken back.") {
    const changed = changing.filter((article) => article.read !== read);
    if (changed.length === 0) return;
    save("read", changed, read, markRead, putRead, failed);
  }

  function putRead(article: Article, read: boolean) {
    if (article.read === read) return;
    article.read = read;
    onUnreadChange(article.feedId, read ? -1 : 1);
  }

  function setStarred(article: Article, starred: boolean) {
    save(
      "starred",
      [article],
      starred,
      markStarred,
      (each, value) => (each.starred = value),
      starred ? "The star couldn't be saved." : "The star couldn't be removed.",
    );
  }

  /** The line says something that has nothing to undo. */
  export function say(message: string) {
    line = message;
    undoLast = undefined;
  }

  /** An undoable action happened: the line says what, and Undo reverses it. */
  function did(message: string, reverse: () => void) {
    line = message;
    undoLast = reverse;
  }

  /**
   * Said only to screen readers: opening an article marks it read quietly
   * on screen, but someone who can't see the title turn grey hears it.
   */
  let spoken = $state("");

  /** The reading area showed this article: it counts as read (not an undoable action). */
  export function shown(article: Article) {
    if (article.read) return;
    setRead([article], true, "An article couldn't be marked as read. It's still unread.");
    // Said at once, like everything on screen (SPEC section 25); if saving
    // fails, the line above the list says so and it's unread again.
    // Emptied first, so the same words are announced again for the next article.
    spoken = "";
    tick().then(() => (spoken = "Marked as read"));
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

<div class="mt-2 flex min-h-11 flex-wrap gap-2">
  <!-- First, so it never moves when "Mark all as read" comes and goes. -->
  {#if !refreshInTopBar}
    <button type="button" aria-disabled={busy} onclick={refresh} class="min-h-11 rounded border border-ink px-4">Refresh</button>
  {/if}
  {#if articles.length > 0}
    <button type="button" bind:this={markAllButton} onclick={markAllRead} class="min-h-11 rounded border border-ink px-4">
      Mark all as read
    </button>
  {/if}
</div>
<!-- The reserved lines: always this tall, so nothing below moves when they fill. -->
<p class="mt-2 flex min-h-6 items-center text-small">
  <span role="status">{updates.stranded ? STRANDED_MESSAGE : newWaiting ? newItemsMessage(touch) : ""}</span>
  {#if updates.stranded}
    <!-- The touch target reaches past the line, so the line keeps its height. -->
    <button type="button" onclick={() => location.reload()} class="-my-3 ml-2 min-w-11 py-3 underline underline-offset-4"
      >Reload</button
    >
  {/if}
</p>
<p class="flex min-h-11 flex-wrap items-center gap-x-1 text-small">
  <span role="status">{line}</span>
  <span aria-live="polite" class="sr-only">{spoken}</span>
  {#if undoLast}
    <span aria-hidden="true">·</span>
    <button type="button" onclick={undoByButton} class="min-h-11 min-w-11 px-2 underline underline-offset-4">Undo</button>
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
            >{#each boldParts(article.title || "Untitled", bold) as part, partIndex (partIndex)}{#if part.bold}<strong
                  class="match">{part.text}</strong
                >{:else}{part.text}{/if}{/each}{#if !article.read}<span class="sr-only">, unread</span>{/if}</span
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
  /*
    A searched word in a title: bold, never colored (DESIGN.md → "Item
    list"). Unread titles are already semibold, and a font may have no
    heavier weight to show, so the letters are also drawn a little thicker,
    in the text's own color.
  */
  .match {
    font-weight: 800;
    -webkit-text-stroke: 0.04em currentColor;
  }
  .star {
    display: inline;
    vertical-align: -1px;
    margin-right: 0.25rem;
  }
</style>
