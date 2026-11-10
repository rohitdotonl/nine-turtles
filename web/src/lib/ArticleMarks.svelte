<!--
  The reader's highlights and notes on the open article (SPEC section 42).
  Their words are drawn in the text in soft pencil: a faint tone of the ink
  behind them and a fine line under them, never a color of their own; one
  with a note ends in a small page. Choosing words opens a small menu
  (Highlight, Add a note…); pressing a highlight opens its own (its note,
  Edit note, Copy, Remove highlight, with Undo).

  At the article's end, above Write back: "Your highlights", each quote with
  its note, Edit note, Copy and Remove (a quote no longer in the article says so, and stays), then "Your
  note", the reader's note on the whole article, written in a box in place.
  The More menu's "Add a note…" and N open that box; h highlights the
  words chosen. On a video or a podcast's episode a new note starts with the
  time it's playing at, and each time in a note takes the player back there.

  Without a connection all of it still works, and one quiet line at the
  foot of the article says where it's kept (OFFLINE_LINE) until it's sent.

  Nothing typed is thrown away (decision 0235): a note left unsaved (by
  Not now, Escape, a press outside its box, or going to another article)
  is kept on this device. Coming back, its box is open at the article's
  end with the words and "Not saved yet. Kept from when you left this
  article."; Discard throws them away, with Undo.
-->
<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import HighlightMenu from "./HighlightMenu.svelte";
  import NoteBox from "./NoteBox.svelte";
  import NoteText from "./NoteText.svelte";
  import { keepDraft, keptDraft, keptWords, worthKeeping } from "./drafts";
  import { isRecord } from "./http";
  import { Marks, OFFLINE_LINE, type Quote } from "./notes.svelte";
  import { paint, quoteOf, unpaint } from "./highlights";
  import { clock } from "./podcasts";
  import { UNDONE } from "./messages";
  import type { Article, FullArticle, Note } from "./shapes";

  let {
    article,
    full,
    text,
    phone = false,
    media,
    say,
    writeBack,
  }: {
    article: Article;
    full: FullArticle;
    /** The article's text, where highlights are drawn. */
    text: HTMLElement | undefined;
    phone?: boolean;
    /** A video's or episode's player, when it has one: where it's playing (null when it isn't), and going back to a time. */
    media?: { now: () => number | null; jump: (seconds: number) => void };
    /** Says what was done in the reading area's top bar ("Highlighted."), as Copy link does. */
    say: (words: string) => void;
    /** Write back about some words: the email starts with them quoted. None when the writer is a publication. */
    writeBack?: (quote: string) => void;
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
  let menu: { anchor: DOMRect; quote?: Quote; highlight?: Note; fresh?: boolean; writing: boolean; from?: Element | null } | undefined = $state();
  /** "Highlight removed · Undo" or "Note discarded · Undo", until something else is done. */
  let undoable: { said: string; undo: () => Promise<void> | void } | undefined = $state();

  // The names the unsaved notes are kept under on this device (drafts.ts); each article has its own.
  // svelte-ignore state_referenced_locally
  const articleDraft = `note:article:${full.id}`;
  const highlightDraft = (id: number) => `note:highlight:${id}`;
  /** One note on words chosen but not yet highlighted, for each article: its words, and the note. */
  // svelte-ignore state_referenced_locally
  const wordsDraft = `note:words:${full.id}`;

  /** The note kept for words chosen but not yet highlighted, if it's for these words. */
  function keptOnWords(quote?: Quote): { quote: Quote; words: string } | undefined {
    const kept = keptDraft(wordsDraft);
    if (!isRecord(kept) || typeof kept.words !== "string" || !isRecord(kept.quote) || typeof kept.quote.quote !== "string") return undefined;
    const was = { quote: kept.quote as Quote, words: kept.words };
    return quote && quote.quote !== was.quote.quote ? undefined : was;
  }

  /**
   * The notes kept unsaved, open in their boxes at the article's end: on a
   * highlight (by its number), or on words not yet highlighted. Each says
   * whether it was kept from when the reader left ("left") or in place ("here").
   */
  type Open = { highlight?: number; quote?: Quote; words: string; kept: "left" | "here" };
  let open: Open[] = $state(
    (() => {
      const kept: Open[] = marks.highlights.flatMap((each) => {
        const words = keptWords(highlightDraft(each.id));
        return words === undefined ? [] : [{ highlight: each.id, words, kept: "left" as const }];
      });
      const onWords = keptOnWords();
      if (onWords) kept.push({ ...onWords, kept: "left" });
      return kept;
    })(),
  );

  // Each open box's words are kept as they're typed, while they're the reader's own.
  $effect(() => {
    for (const each of open) {
      if (each.highlight !== undefined) {
        const saved = marks.highlights.find((highlight) => highlight.id === each.highlight)?.note ?? "";
        keepDraft(highlightDraft(each.highlight), worthKeeping(each.words, saved) ? each.words : undefined);
      } else if (each.quote) keepDraft(wordsDraft, worthKeeping(each.words, "") ? { quote: each.quote, words: each.words } : undefined);
    }
  });

  /** The words in the small menu's box, kept as they're typed (unless they're what was there to start with). */
  function keepMenuWords(words: string) {
    const at = menu;
    if (!at) return;
    if (at.highlight) {
      const name = highlightDraft(at.highlight.id);
      keepDraft(name, worthKeeping(words, at.highlight.note ?? startTime() ?? "") ? words : undefined);
    } else if (at.quote) {
      if (worthKeeping(words, startTime() ?? "")) keepDraft(wordsDraft, { quote: at.quote, words });
      // Another chosen words' note is left alone.
      else if (keptOnWords(at.quote)) keepDraft(wordsDraft, undefined);
    }
  }

  /** What the small menu's box starts with, when a note on its words was kept unsaved. */
  function keptForMenu(): string | undefined {
    if (menu?.highlight) return keptWords(highlightDraft(menu.highlight.id));
    return menu?.quote ? keptOnWords(menu.quote)?.words : undefined;
  }

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
    undoable = undefined;
    const from = document.activeElement;
    getSelection()?.removeAllRanges();
    menu = undefined;
    const { made, problem } = await marks.highlight(quote);
    say(problem ?? "Highlighted.");
    if (!made) return;
    // A small menu beside the new highlight says so, and offers a note on it there and then, or Done.
    await tick();
    const at = text?.querySelector(`[data-highlight="${made.id}"]`);
    if (at) menu = { anchor: at.getBoundingClientRect(), highlight: made, fresh: true, writing: false, from };
  }

  /** Saves a note on a highlight, or highlights words with their note. The box stays open, with the words, until it's saved; answers why, if it couldn't be. */
  async function saveOn(on: { highlight?: number; quote?: Quote }, note: string): Promise<string | undefined> {
    undoable = undefined;
    let problem: string | undefined;
    if (on.highlight !== undefined) problem = await marks.setNote(on.highlight, note);
    else if (on.quote) problem = (await marks.highlight(on.quote, note.trim() || null)).problem;
    if (problem) return problem;
    keepDraft(on.highlight !== undefined ? highlightDraft(on.highlight) : wordsDraft, undefined);
    say("Note saved.");
    return undefined;
  }

  async function saveNote(note: string): Promise<string | undefined> {
    const at = menu;
    if (!at) return undefined;
    if (at.quote) getSelection()?.removeAllRanges();
    const problem = await saveOn({ highlight: at.highlight?.id, quote: at.quote }, note);
    if (menu !== at) {
      // The menu was closed while it waited: the words are kept for its box, and the top bar says why they weren't saved.
      if (problem) say(problem);
    } else if (!problem) menu = undefined;
    return problem;
  }

  /** Saves a note in a box at the article's end; once saved, the box gives way to the highlight. */
  async function saveOpen(each: Open, note: string): Promise<string | undefined> {
    const problem = await saveOn(each, note);
    if (!problem) open = open.filter((other) => other !== each);
    return problem;
  }

  /** Discard: the kept words are thrown away, with Undo, which brings their box back. */
  async function discard(name: string, back: () => void) {
    const was = keptDraft(name);
    keepDraft(name, undefined);
    undoable = {
      said: "Note discarded",
      undo: () => {
        keepDraft(name, was);
        back();
        say(UNDONE);
      },
    };
    say("Note discarded.");
    await tick();
    undoButton?.focus({ preventScroll: true });
  }

  function discardOpen(each: Open) {
    open = open.filter((other) => other !== each);
    void discard(each.highlight !== undefined ? highlightDraft(each.highlight) : wordsDraft, () => (open = [...open, { ...each, kept: "here" }]));
  }

  /** Discard in the small menu: its box closes, and Undo opens the kept words at the article's end. */
  function discardInMenu() {
    const at = menu;
    if (!at) return;
    const words = keptForMenu() ?? "";
    close(true);
    const each: Open = { highlight: at.highlight?.id, quote: at.highlight ? undefined : at.quote, words, kept: "here" };
    void discard(at.highlight ? highlightDraft(at.highlight.id) : wordsDraft, () => (open = [...open, each]));
  }

  async function copy(highlight: Note) {
    close();
    const credit = [article.feedTitle, article.link].filter(Boolean).join(" · ");
    try {
      await navigator.clipboard.writeText(`“${highlight.quote}”\n${credit}`);
      say("Highlight copied.");
    } catch {
      say("The highlight couldn't be copied. Select its words and copy them yourself.");
    }
  }

  async function remove(highlight: Note) {
    close();
    const { was, problem } = await marks.remove(highlight.id);
    undoable = was && { said: "Highlight removed", undo: async () => say((await marks.restore(was)) ?? UNDONE) };
    say(problem ?? "Highlight removed.");
    // Its buttons are gone: the keyboard goes to Undo.
    await tick();
    undoButton?.focus({ preventScroll: true });
  }

  async function undo() {
    const was = undoable;
    undoable = undefined;
    await was?.undo();
  }

  // Without a connection, the quiet line at the foot is said once as well, for a screen reader.
  let saidOffline = false;
  $effect(() => {
    if (marks.waits && !saidOffline) say(OFFLINE_LINE);
    saidOffline = marks.waits;
  });

  /** Shows a highlight in the text, from the list at the article's end. */
  function show(highlight: Note) {
    const at = text?.querySelector(`[data-highlight="${highlight.id}"]`);
    at?.scrollIntoView({ block: "center" });
  }

  // The note on the whole article: open at once, with its words, when some were kept unsaved.
  const keptOnArticle = keptWords(articleDraft);
  let editingArticle = $state(keptOnArticle !== undefined);
  let draft = $state(keptOnArticle ?? "");
  let articleKept: "left" | "here" | undefined = $state(keptOnArticle === undefined ? undefined : "left");
  let articleBox: NoteBox | undefined = $state();
  let editButton: HTMLButtonElement | undefined = $state();
  let undoButton: HTMLButtonElement | undefined = $state();
  /** Where the keyboard was before the note box opened, for when Edit note is gone (the note emptied). */
  let noteFrom: Element | null = null;

  /** "Add a note…" (More, N with nothing chosen): the box at the article's end, ready to type in. */
  export async function writeArticleNote() {
    if (!editingArticle) {
      const kept = keptWords(articleDraft);
      draft = kept ?? marks.articleNote?.note ?? startTime() ?? "";
      articleKept = kept === undefined ? undefined : "here";
      noteFrom = document.activeElement;
      editingArticle = true;
    }
    await tick();
    articleBox?.show();
    await articleBox?.focus();
  }

  // The article's note is kept as it's typed, while it differs from what's saved.
  $effect(() => {
    if (editingArticle) keepDraft(articleDraft, worthKeeping(draft, marks.articleNote?.note ?? "") ? draft : undefined);
  });

  /** The words the reader highlighted, in the order they were made: Write back starts the email with them. */
  export function quotes(): string[] {
    return marks.highlights.flatMap((each) => (each.quote ? [each.quote] : []));
  }

  /** Write back about this: the words chosen or pressed, quoted at the top of the email. */
  function writeBackAbout() {
    const words = menu?.highlight?.quote ?? menu?.quote?.quote;
    close();
    getSelection()?.removeAllRanges();
    if (words && writeBack) writeBack(words);
  }

  /** h: highlights the words chosen. */
  export function highlight() {
    void highlightChosen();
  }

  /** N: a note on the words chosen, or, with none, on the whole article. */
  export function note() {
    const now = menu?.quote ? { quote: menu.quote, anchor: menu.anchor } : chosen();
    if (now) menu = { ...now, writing: true, from: document.activeElement };
    else void writeArticleNote();
  }

  /** The box stays open, with the words, until they're saved; answers why, if they couldn't be. */
  async function saveArticleNote(words: string): Promise<string | undefined> {
    undoable = undefined;
    const problem = await marks.setArticleNote(words);
    if (problem) return problem;
    keepDraft(articleDraft, undefined);
    editingArticle = false;
    articleKept = undefined;
    say(words.trim() ? "Note saved." : "Note removed.");
    await giveBack();
    return undefined;
  }

  /** Not now: the box closes; words that weren't saved are kept for next time. */
  async function notNow() {
    editingArticle = false;
    await giveBack();
  }

  function discardArticle() {
    const words = draft;
    editingArticle = false;
    articleKept = undefined;
    void discard(articleDraft, () => {
      draft = words;
      articleKept = "here";
      editingArticle = true;
    });
  }

  /** The keyboard goes to Edit note, or, with no note left, back where it was. */
  async function giveBack() {
    await tick();
    const to = editButton ?? (noteFrom instanceof HTMLElement && noteFrom.isConnected ? noteFrom : undefined);
    to?.focus({ preventScroll: true });
  }
</script>

{#if marks.highlights.length > 0 || marks.articleNote || editingArticle || open.length > 0}
  <section class="marks" aria-labelledby="marks-title" lang="en">
    <h3 id="marks-title" class="sr-only">Your highlights and note</h3>
    {#if marks.highlights.length > 0 || open.length > 0}
      <p class="label" aria-hidden="true">Your highlights</p>
      <ul class="flex flex-col gap-4" aria-label="Your highlights">
        {#each marks.highlights as each (each.id)}
          {@const box = open.find((kept) => kept.highlight === each.id)}
          <li class="quote">
            {#if missing.has(each.id)}
              <p class="font-serif text-ink">{each.quote}</p>
              <p class="gone">No longer in the article</p>
            {:else}
              <button type="button" class="font-serif text-ink text-left" title="Show in the article" onclick={() => show(each)}>{each.quote}</button>
            {/if}
            {#if box}
              <NoteBox id="kept-note-{each.id}" label="A note on these words" help="Only you see it." bind:words={box.words} kept={box.kept} onSave={(words) => saveOpen(box, words)} onNotNow={() => (open = open.filter((other) => other !== box))} onDiscard={() => discardOpen(box)} />
            {:else}
            {#if each.note}<div class="text-meta"><NoteText note={each.note} jump={media?.jump} /></div>{/if}
            <div class="-ml-3 flex flex-wrap">
              <button type="button" class="btn-quiet" aria-label="{each.note ? 'Edit note' : 'Add a note'} on “{each.quote}”" onclick={(event) => (menu = { anchor: event.currentTarget.getBoundingClientRect(), highlight: each, writing: true, from: event.currentTarget })}
                >{each.note ? "Edit note" : "Add a note…"}</button
              >
              <button type="button" class="btn-quiet" aria-label="Copy “{each.quote}”" onclick={() => copy(each)}>Copy</button>
              <button type="button" class="btn-quiet" aria-label="Remove highlight “{each.quote}”" onclick={() => remove(each)}>Remove</button>
            </div>
            {/if}
          </li>
        {/each}
        <!-- A note on words not highlighted yet: Save highlights them with it. -->
        {#each open.filter((kept) => kept.quote) as box (box)}
          <li class="quote">
            <p class="font-serif text-ink">{box.quote?.quote}</p>
            <NoteBox id="kept-note-words" label="A note on these words" help="Only you see it. Save highlights the words." bind:words={box.words} kept={box.kept} onSave={(words) => saveOpen(box, words)} onNotNow={() => (open = open.filter((other) => other !== box))} onDiscard={() => discardOpen(box)} />
          </li>
        {/each}
      </ul>
    {/if}
    {#if editingArticle}
      <NoteBox
        bind:this={articleBox}
        id="article-note"
        label="A note on this article"
        help="Only you see it. Search finds it, and Your data exports it."
        bind:words={draft}
        kept={articleKept}
        onSave={saveArticleNote}
        onNotNow={notNow}
        onDiscard={discardArticle}
      />
    {:else if marks.articleNote?.note}
      <p class="label">Your note</p>
      <div class="text-base"><NoteText note={marks.articleNote.note} jump={media?.jump} /></div>
      <button type="button" class="btn-quiet -ml-3 self-start" bind:this={editButton} onclick={writeArticleNote}>Edit note</button>
    {/if}
  </section>
{/if}

{#if marks.waits || undoable}
  <div class="foot floating" lang="en">
    {#if undoable}
      <p>{undoable.said}</p>
      <button type="button" class="btn-quiet" bind:this={undoButton} onclick={undo}>Undo</button>
    {/if}
    {#if marks.waits}<p class="text-ink-2">{OFFLINE_LINE}</p>{/if}
  </div>
{/if}

{#if menu}
  <HighlightMenu
    anchor={menu.anchor}
    highlight={menu.highlight}
    fresh={menu.fresh}
    bind:writing={menu.writing}
    {phone}
    {startTime}
    jump={media?.jump}
    onHighlight={() => void highlightChosen()}
    onSaveNote={saveNote}
    kept={keptForMenu}
    onWords={keepMenuWords}
    onDiscard={discardInMenu}
    onCopy={() => menu?.highlight && copy(menu.highlight)}
    onRemove={() => menu?.highlight && remove(menu.highlight)}
    onWriteBack={writeBack && writeBackAbout}
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
  }
  /* Each highlight: its words in the reading serif, set off by a fine line at the left, as a quotation is. */
  .quote {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-left: 1rem;
    border-left: 2px solid var(--strong);
    font-size: var(--text-base);
    line-height: 1.55;
  }
  .gone {
    color: var(--muted);
    font-size: var(--text-meta);
    font-style: italic;
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
    font-size: var(--text-meta);
  }
  /*
    A highlight in the text: soft pencil (decision 0164), a faint tone of the
    ink behind the words and a fine line under them, in every theme; the
    page's own colors, never a new one, and never color alone (the line).
  */
  :global(mark.highlight) {
    color: inherit;
    background-color: var(--line);
    box-shadow: inset 0 -1.5px 0 color-mix(in srgb, var(--ink) 65%, transparent);
    border-radius: var(--radius-mark);
    cursor: pointer;
  }
  /* The note's page icon, at the size beside a word: 16px, 18 on a touch screen (DESIGN.md → "The system"). */
  @media (pointer: coarse) {
    :global(.highlight-icon svg) {
      width: 1.125rem;
      height: 1.125rem;
    }
  }
  :global(.highlight-icon) {
    display: inline-flex;
    margin-left: 0.25rem;
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
