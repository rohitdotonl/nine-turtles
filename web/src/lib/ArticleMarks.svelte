<!--
  The reader's highlights and notes on the open article (SPEC section 42).
  Their words are drawn in the text in soft pencil: a faint tone of the ink
  behind them and a fine line under them, never a color of their own; one
  with a note ends in a small page. Choosing words opens a small menu
  (Highlight, Add a note…); pressing a highlight opens its own (its note,
  Edit note, Copy, Remove highlight, with Undo).

  At the article's end, above Write back: "Your highlights", each quote with
  its note (a quote no longer in the article says so, and stays), then "Your
  note", the reader's note on the whole article, written in a box in place.
  The More menu's "Add a note…" and Shift+H open that box; h highlights the
  words chosen. On a video or a podcast's episode a new note starts with the
  time it's playing at, and each time in a note takes the player back there.

  Without a connection all of it still works, and one quiet line at the
  foot of the article says where it's kept (OFFLINE_LINE) until it's sent.
-->
<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import HighlightMenu from "./HighlightMenu.svelte";
  import NoteText from "./NoteText.svelte";
  import { Marks, LONGEST_NOTE, OFFLINE_LINE, type Quote } from "./notes.svelte";
  import { paint, quoteOf, unpaint } from "./highlights";
  import { clock } from "./podcasts";
  import type { Article, FullArticle, Note } from "./shapes";

  let {
    article,
    full,
    text,
    phone = false,
    media,
  }: {
    article: Article;
    full: FullArticle;
    /** The article's text, where highlights are drawn. */
    text: HTMLElement | undefined;
    phone?: boolean;
    /** A video's or episode's player, when it has one: where it's playing (null when it isn't), and going back to a time. */
    media?: { now: () => number | null; jump: (seconds: number) => void };
  } = $props();

  // Each article has its own: the reading area makes this anew for each article it opens.
  // svelte-ignore state_referenced_locally
  const marks = new Marks(full);
  onDestroy(() => marks.close());

  /** The highlights whose words aren't in the article any more, by number. */
  let missing: Set<number> = $state(new Set());

  // Draws the highlights whenever the text or they change: all are taken off, then each is found again.
  $effect(() => {
    const body = text;
    const all = marks.highlights;
    void full.content;
    if (!body) return;
    unpaint(body);
    const gone = new Set<number>();
    for (const each of all) if (each.quote !== null && !paint(body, { ...each, quote: each.quote })) gone.add(each.id);
    missing = gone;
  });

  /** The small menu: for words just chosen, or for a highlight pressed. */
  let menu: { anchor: DOMRect; quote?: Quote; highlight?: Note; writing: boolean; from?: Element | null } | undefined = $state();
  /** "Highlight removed · Undo", until something else is done. */
  let removed: Note | undefined = $state();
  let said = $state("");

  /** The words chosen in the article now, if any. */
  function chosen(): { quote: Quote; anchor: DOMRect } | undefined {
    const selection = getSelection();
    if (!text || !selection || selection.rangeCount === 0) return undefined;
    const range = selection.getRangeAt(0);
    const quote = quoteOf(text, range);
    return quote ? { quote, anchor: range.getBoundingClientRect() } : undefined;
  }

  // Words chosen with the mouse, a finger or the keyboard open the menu beside them.
  $effect(() => {
    const body = text;
    if (!body) return;
    const look = () => {
      if (menu?.writing || menu?.highlight) return;
      const now = chosen();
      menu = now ? { anchor: now.anchor, quote: now.quote, writing: false } : undefined;
    };
    const press = (event: MouseEvent) => {
      const at = event.target instanceof Element ? event.target.closest("[data-highlight]") : null;
      if (!at || !getSelection()?.isCollapsed) return;
      const highlight = marks.highlights.find((each) => String(each.id) === (at as HTMLElement).dataset.highlight);
      if (highlight) menu = { anchor: at.getBoundingClientRect(), highlight, writing: false, from: document.activeElement };
    };
    const changed = () => {
      if (menu?.quote && !menu.writing && getSelection()?.isCollapsed) menu = undefined;
    };
    body.addEventListener("pointerup", look);
    body.addEventListener("keyup", look);
    body.addEventListener("click", press);
    document.addEventListener("selectionchange", changed);
    return () => {
      body.removeEventListener("pointerup", look);
      body.removeEventListener("keyup", look);
      body.removeEventListener("click", press);
      document.removeEventListener("selectionchange", changed);
    };
  });

  function close(giveBack = false) {
    const from = menu?.from;
    menu = undefined;
    if (giveBack && from instanceof HTMLElement) from.focus({ preventScroll: true });
  }

  /** The time the video or episode is playing at, to start a note with. */
  function startTime(): string | undefined {
    const now = media?.now();
    return now === null || now === undefined ? undefined : `${clock(now)} `;
  }

  async function highlightChosen(quote: Quote | undefined = menu?.quote ?? chosen()?.quote) {
    if (!quote) return;
    removed = undefined;
    getSelection()?.removeAllRanges();
    menu = undefined;
    await marks.highlight(quote);
    said = "Highlighted.";
  }

  async function saveNote(note: string) {
    const open = menu;
    menu = undefined;
    if (!open) return;
    if (open.highlight) await marks.setNote(open.highlight.id, note);
    else if (open.quote) {
      getSelection()?.removeAllRanges();
      await marks.highlight(open.quote, note.trim() || null);
    }
    said = "Note saved.";
  }

  async function copy(highlight: Note) {
    close();
    const credit = [article.feedTitle, article.link].filter(Boolean).join(" · ");
    try {
      await navigator.clipboard.writeText(`“${highlight.quote}”\n${credit}`);
      said = "Copied.";
    } catch {
      said = "It couldn't be copied.";
    }
  }

  async function remove(highlight: Note) {
    close();
    removed = await marks.remove(highlight.id);
    said = "";
  }

  async function undo() {
    const was = removed;
    removed = undefined;
    if (was) await marks.restore(was);
    said = "Highlight put back.";
  }

  /** Shows a highlight in the text, from the list at the article's end. */
  function show(highlight: Note) {
    const at = text?.querySelector(`[data-highlight="${highlight.id}"]`);
    at?.scrollIntoView({ block: "center" });
  }

  // The note on the whole article.
  let editingArticle = $state(false);
  let draft = $state("");
  let box: HTMLTextAreaElement | undefined = $state();
  let editButton: HTMLButtonElement | undefined = $state();

  /** "Add a note…" (More, Shift+H with nothing chosen): the box at the article's end, ready to type in. */
  export async function writeArticleNote() {
    draft = marks.articleNote?.note ?? startTime() ?? "";
    editingArticle = true;
    await tick();
    box?.scrollIntoView({ block: "center" });
    box?.focus();
    box?.setSelectionRange(draft.length, draft.length);
  }

  /** h: highlights the words chosen. */
  export function highlight() {
    void highlightChosen();
  }

  /** Shift+H: a note on the words chosen, or, with none, on the whole article. */
  export function note() {
    const now = menu?.quote ? { quote: menu.quote, anchor: menu.anchor } : chosen();
    if (now) menu = { ...now, writing: true, from: document.activeElement };
    else void writeArticleNote();
  }

  async function saveArticleNote(event: SubmitEvent) {
    event.preventDefault();
    editingArticle = false;
    await marks.setArticleNote(draft);
    said = draft.trim() ? "Note saved." : "Note removed.";
    await tick();
    editButton?.focus();
  }

  async function notNow() {
    editingArticle = false;
    await tick();
    editButton?.focus();
  }
</script>

{#if marks.highlights.length > 0 || marks.articleNote || editingArticle}
  <section class="marks" aria-labelledby="marks-title" lang="en">
    <h3 id="marks-title" class="sr-only">Your highlights and note</h3>
    {#if marks.highlights.length > 0}
      <p class="label" aria-hidden="true">Your highlights</p>
      <ul class="flex flex-col gap-4" aria-label="Your highlights">
        {#each marks.highlights as each (each.id)}
          <li class="quote">
            {#if missing.has(each.id)}
              <p class="font-serif text-ink">{each.quote}</p>
              <p class="gone">No longer in the article</p>
            {:else}
              <button type="button" class="font-serif text-ink text-left" title="Show in the article" onclick={() => show(each)}>{each.quote}</button>
            {/if}
            {#if each.note}<div class="text-small"><NoteText note={each.note} jump={media?.jump} /></div>{/if}
            <div class="-ml-3 flex flex-wrap">
              <button type="button" class="btn-quiet" aria-label="{each.note ? 'Edit note' : 'Add a note'} on “{each.quote}”" onclick={(event) => (menu = { anchor: event.currentTarget.getBoundingClientRect(), highlight: each, writing: true, from: event.currentTarget })}
                >{each.note ? "Edit note" : "Add a note…"}</button
              >
              <button type="button" class="btn-quiet" aria-label="Remove highlight “{each.quote}”" onclick={() => remove(each)}>Remove</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
    {#if editingArticle}
      <form class="note-form flex flex-col gap-3" onsubmit={saveArticleNote}>
        <label class="text-base font-semibold text-ink" for="article-note">A note on this article</label>
        <textarea id="article-note" bind:this={box} bind:value={draft} maxlength={LONGEST_NOTE} rows="4" class="field note-box"></textarea>
        <p class="text-small text-ink-2">Only you see it. Search finds it, and Your data exports it.</p>
        <div class="flex flex-wrap gap-2">
          <button type="submit" class="btn-primary">Save</button>
          <button type="button" class="btn-quiet" onclick={notNow}>Not now</button>
        </div>
      </form>
    {:else if marks.articleNote?.note}
      <p class="label">Your note</p>
      <div class="text-base"><NoteText note={marks.articleNote.note} jump={media?.jump} /></div>
      <button type="button" class="btn-quiet -ml-3 self-start" bind:this={editButton} onclick={writeArticleNote}>Edit note</button>
    {/if}
  </section>
{/if}

<!-- Said to screen readers as it happens; seen in the line at the foot only when there's something to do or know. -->
<p role="status" class="sr-only">{said}</p>
{#if marks.waits || removed}
  <div class="foot floating" lang="en">
    {#if removed}
      <p>Highlight removed</p>
      <button type="button" class="btn-quiet" onclick={undo}>Undo</button>
    {/if}
    {#if marks.waits}<p class="text-ink-2">{OFFLINE_LINE}</p>{/if}
  </div>
{/if}

{#if menu}
  <HighlightMenu
    anchor={menu.anchor}
    highlight={menu.highlight}
    bind:writing={menu.writing}
    {phone}
    {startTime}
    jump={media?.jump}
    onHighlight={() => void highlightChosen()}
    onSaveNote={saveNote}
    onCopy={() => menu?.highlight && copy(menu.highlight)}
    onRemove={() => menu?.highlight && remove(menu.highlight)}
    onClose={close}
  />
{/if}

<style>
  /* Above Write back, in the interface's type, as the article's end matter is. */
  .marks {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 2rem;
    font-family: var(--font-sans);
  }
  .label {
    margin-top: 0.75rem;
    color: var(--muted);
    font-size: var(--text-meta);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  /* Each highlight: its words in the reading serif, set off by a fine line at the left, as a quotation is. */
  .quote {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-left: 0.875rem;
    border-left: 2px solid color-mix(in srgb, var(--ink) 18%, transparent);
    font-size: var(--text-base);
    line-height: 1.55;
  }
  .gone {
    color: var(--muted);
    font-size: var(--text-small);
    font-style: italic;
  }
  .note-form {
    padding: 1rem 1.125rem;
    border: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
    border-radius: 0.75rem;
  }
  .note-box {
    min-height: 6rem;
    resize: vertical;
    line-height: 1.5;
  }
  /* The quiet line at the foot of the article, staying in view while the article scrolls. */
  .foot {
    position: sticky;
    bottom: 1rem;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.75rem;
    margin-top: 1.5rem;
    padding: 0.5rem 0.75rem 0.5rem 1rem;
    font-family: var(--font-sans);
    font-size: var(--text-small);
  }
  /*
    A highlight in the text: soft pencil (decision 0161), a faint tone of the
    ink behind the words and a fine line under them, in every theme; the
    page's own colors, never a new one, and never color alone (the line).
  */
  :global(mark.highlight) {
    color: inherit;
    background-color: color-mix(in srgb, var(--ink) 9%, transparent);
    box-shadow: inset 0 -1.5px 0 color-mix(in srgb, var(--ink) 45%, transparent);
    border-radius: 2px;
    cursor: pointer;
  }
  :global(.highlight-icon) {
    display: inline-flex;
    margin-left: 3px;
    vertical-align: 0.1em;
    color: var(--ink-2);
    cursor: pointer;
  }
  @media (forced-colors: active) {
    :global(mark.highlight) {
      background-color: Mark;
      color: MarkText;
    }
  }
</style>
