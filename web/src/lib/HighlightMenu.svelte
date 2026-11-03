<!--
  The small menu beside words in an article (SPEC section 42). For words
  just chosen: Highlight (its key, h) and Add a note…. For a highlight that's
  pressed: its note, then Edit note (or Add a note…), Copy and Remove
  highlight. A note is written in place, in a box with Save and Not now; on
  a video or a podcast's episode it starts with the time it's playing at.
  It sits under the words (above them when there's no room below), inside
  the window, and closes with Escape or a press outside it.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { currentKey } from "./keys.svelte";
  import { LONGEST_NOTE } from "./notes.svelte";
  import NoteText from "./NoteText.svelte";
  import type { Note } from "./shapes";

  let {
    anchor,
    highlight,
    writing = $bindable(false),
    phone = false,
    startTime,
    jump,
    onHighlight,
    onSaveNote,
    onCopy,
    onRemove,
    onClose,
  }: {
    /** Where the words are on the screen. */
    anchor: DOMRect;
    /** The highlight pressed; none for words just chosen. */
    highlight?: Note;
    /** Writing its note. */
    writing?: boolean;
    phone?: boolean;
    /** The time a video or episode is playing at, to start a new note with ("12:34 "); none without one. */
    startTime?: () => string | undefined;
    jump?: (seconds: number) => void;
    onHighlight: () => void;
    onSaveNote: (note: string) => void;
    onCopy: () => void;
    onRemove: () => void;
    /** `giveBack`: the keyboard goes back to where it was. */
    onClose: (giveBack: boolean) => void;
  } = $props();

  let menu: HTMLDivElement | undefined = $state();
  let box: HTMLTextAreaElement | undefined = $state();
  let draft = $state("");
  let height = $state(0);
  let width = $state(0);

  /** Under the words, or above them when there's no room below; never past the window's edges (16px kept clear). */
  let place = $derived.by(() => {
    const left = Math.max(16, Math.min(anchor.left, innerWidth - width - 16));
    const below = anchor.bottom + 8;
    const top = below + height + 16 > innerHeight && anchor.top - height - 8 > 16 ? anchor.top - height - 8 : below;
    return `left: ${left}px; top: ${top}px;`;
  });

  /** Starts writing the note: what it says now, or the player's time to begin a new one. */
  export async function write() {
    draft = highlight?.note ?? "";
    if (!draft) draft = startTime?.() ?? "";
    writing = true;
    await tick();
    box?.focus();
    box?.setSelectionRange(draft.length, draft.length);
  }

  // Opened to write a note straight away (Shift+H, or "Add a note…" on words just chosen).
  // A highlight pressed: the keyboard goes to its first choice, as in any menu.
  onMount(() => {
    if (writing) void write();
    else if (highlight) menu?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
  });

  // A press anywhere outside closes it (words chosen elsewhere open their own), as does Escape
  // wherever the keyboard is, and scrolling the article, unless a note is being written.
  $effect(() => {
    const away = (event: PointerEvent) => {
      if (menu && event.target instanceof Node && !menu.contains(event.target)) onClose(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose(true);
    };
    const scrolled = (event: Event) => {
      if (!writing && !(event.target instanceof Node && menu?.contains(event.target))) onClose(false);
    };
    document.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", escape, true);
    document.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", escape, true);
      document.removeEventListener("scroll", scrolled, true);
    };
  });

  function save(event: SubmitEvent) {
    event.preventDefault();
    onSaveNote(draft);
  }
</script>

<div
  bind:this={menu}
  bind:offsetHeight={height}
  bind:offsetWidth={width}
  role={writing ? "dialog" : "menu"}
  aria-label={writing ? (highlight?.note ? "Edit note" : "Add a note") : highlight ? "Highlight" : "Chosen words"}
  tabindex="-1"
  class="floating highlight-menu"
  style={place}
  lang="en"
  onpointerdown={(event) => {
    // Pressing a button keeps the words chosen, so they can still be highlighted.
    if (!(event.target instanceof HTMLTextAreaElement)) event.preventDefault();
  }}
>
  {#if writing}
    <form class="flex flex-col gap-3 p-3" onsubmit={save}>
      <label for="highlight-note" class="text-small font-semibold text-ink">{highlight?.note ? "Your note" : "A note on these words"}</label>
      <textarea id="highlight-note" bind:this={box} bind:value={draft} maxlength={LONGEST_NOTE} rows="4" class="field note-box"></textarea>
      <p class="text-meta text-muted">Only you see it.</p>
      <div class="flex flex-wrap gap-2">
        <button type="submit" class="btn-primary">Save</button>
        <button type="button" class="btn-quiet" onclick={() => onClose(true)}>Not now</button>
      </div>
    </form>
  {:else}
    {#if highlight?.note}
      <div class="text-small menu-note"><NoteText note={highlight.note} {jump} /></div>
    {/if}
    {#if !highlight}
      <button type="button" role="menuitem" class="menu-item" onclick={onHighlight}
        >Highlight{#if !phone}<kbd>{currentKey("highlight")}</kbd>{/if}</button
      >
    {/if}
    <button type="button" role="menuitem" class="menu-item" onclick={() => void write()}>{highlight?.note ? "Edit note" : "Add a note…"}</button>
    {#if highlight}
      <button type="button" role="menuitem" class="menu-item" onclick={onCopy}>Copy</button>
      <button type="button" role="menuitem" class="menu-item text-danger" onclick={onRemove}>Remove highlight</button>
    {/if}
  {/if}
</div>

<style>
  .highlight-menu {
    position: fixed;
    z-index: 40;
    display: flex;
    flex-direction: column;
    width: max-content;
    min-width: 13rem;
    max-width: min(22rem, calc(100vw - 2rem));
    padding: 0.375rem;
    font-family: var(--font-sans);
  }
  .highlight-menu:has(form) {
    width: min(22rem, calc(100vw - 2rem));
  }
  .menu-item {
    display: flex;
    width: 100%;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.75rem;
    border-radius: 0.5rem;
    color: var(--ink);
    font-size: var(--text-ui);
    text-align: left;
  }
  .menu-item.text-danger {
    color: var(--danger);
  }
  @media (hover: hover) {
    .menu-item:hover {
      background-color: var(--hover);
    }
  }
  .menu-item:focus-visible {
    outline-offset: -2px;
  }
  kbd {
    margin-left: auto;
    color: var(--muted);
    font-family: inherit;
    font-size: var(--text-meta);
  }
  /* The highlight's note, above what can be done with it. */
  .menu-note {
    padding: 0.5rem 0.75rem 0.625rem;
    margin-bottom: 0.25rem;
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
  }
  .note-box {
    min-height: 6rem;
    resize: vertical;
    line-height: 1.5;
  }
</style>
