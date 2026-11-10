<!--
  The search field (SPEC section 14), above the item list. Where it searches
  shows as one chip inside the field (`in: Tech`), where you are to begin
  with; its button removes it, to search everything, and so does Backspace
  at the start of the field. Nothing else is chosen: a search from Starred
  finds only starred ones (decision 0241).

  Enter searches straight away; otherwise the search follows a moment after
  typing stops. Escape is the app's: it closes search and returns you to
  where you were.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Feed, Folder } from "./shapes";
  import { chipsFor, withoutChip, type Query } from "./search";

  let {
    query,
    feeds,
    folders,
    onChange,
  }: {
    query: Query;
    feeds: Feed[];
    folders: Folder[];
    /** The query changed; `now` when the search should follow at once, not after a pause in typing. */
    onChange: (query: Query, now: boolean) => void;
  } = $props();

  let field: HTMLInputElement | undefined = $state();

  let library = $derived({ feeds, folders });
  let chips = $derived(chipsFor(query, library));
  /** The keyboard or a pointer is inside the search (a press counts, so a chip's button can't vanish under a click). */
  let inside = $state(false);
  let pressing = false;
  let searchElement: HTMLElement | undefined = $state();

  /**
   * A press ended: once its click has landed (so a chip's button never
   * vanishes under it), the search is "inside" only if the keyboard's place
   * is still in it. Some browsers don't focus a clicked button, so this
   * doesn't wait for a focus change.
   */
  function pressEnded() {
    if (!pressing) return;
    pressing = false;
    setTimeout(() => (inside = searchElement?.contains(document.activeElement) ?? false));
  }
  /**
   * At rest, before any search, "in: Tech" would only repeat the list's own
   * title, so the field says "Search Tech" instead; the chip appears as soon
   * as you're in the search.
   */
  let resting = $derived(!inside && query.words.trim() === "" && chips.length === 1 && chips[0]?.key === "scope");
  let shownChips = $derived(resting ? [] : chips);

  export function focus() {
    field?.focus();
  }

  function typed(event: Event) {
    onChange({ ...query, words: (event.currentTarget as HTMLInputElement).value }, false);
  }

  /** The × in the field: the typed words go, and the search follows at once. */
  function clear() {
    onChange({ ...query, words: "" }, true);
    field?.focus();
  }

  function remove() {
    onChange(withoutChip(query), true);
    field?.focus();
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      onChange({ ...query, words: query.words.trim() }, true);
    } else if (event.key === "Backspace" && field?.selectionStart === 0 && field.selectionEnd === 0) {
      if (chips.length === 0) return;
      event.preventDefault();
      remove();
    }
  }
</script>

<svelte:window onpointerup={pressEnded} onpointercancel={pressEnded} />

<!-- svelte-ignore a11y_no_static_element_interactions: the pointer handler only notes a press; it acts on nothing. -->
<search
  class="relative mb-2"
  onfocusin={() => (inside = true)}
  onfocusout={(event) => {
    if (pressing || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    inside = false;
  }}
  bind:this={searchElement}
  onpointerdown={() => (pressing = true)}
>
  <!-- The whole box acts as the field: a click anywhere in it (not on a chip's button) puts you in the field. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="search-box search-capsule relative flex min-w-0 cursor-text items-center gap-1 pl-3"
    onclick={(event) => {
      if (event.target === event.currentTarget) field?.focus();
    }}
  >
    <!-- The one search field's look, shared with the sidebar's find field (decision 0051). -->
    <span class="flex w-4 shrink-0 justify-center text-muted"><Icon name="search" /></span>
    <!-- One line: the chip shrinks and ends in "…" (its whole text is in its tooltip and its Remove button's name). -->
    <div class="flex min-w-0 flex-1 items-center gap-1">
      {#each shownChips as chip (chip.key)}
        <span class={["chip my-1 flex h-6 min-w-0 shrink items-center rounded-press bg-[var(--fill)] pl-2 text-meta whitespace-nowrap max-w-[60%]"]}>
          <span class="min-w-0 truncate" title={chip.label}>{chip.label}</span>
          <button type="button" aria-label="Remove {chip.label}" onclick={remove} class="-my-3 -mr-2 -ml-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
            <Icon name="close" />
          </button>
        </span>
      {/each}
      <label for="search-field" class="sr-only">Search articles</label>
      <input
        id="search-field"
        dir="auto"
        bind:this={field}
        type="text"
        value={query.words}
        oninput={typed}
        onkeydown={keydown}
        placeholder={shownChips.length > 0 ? "" : "Search articles"}
        autocomplete="off"
        spellcheck="false"
        class="min-h-(--search-height) min-w-16 flex-1 basis-16 bg-transparent px-1 placeholder:text-muted"
      />
    </div>
    {#if query.words !== ""}
      <!-- Once there's text, an × empties the field (the chips stay) and leaves the keyboard in it. -->
      <button
        type="button"
        aria-label="Clear search"
        title="Clear search"
        onclick={clear}
        class="flex size-(--search-height) shrink-0 cursor-pointer items-center justify-center self-start text-ink-2"
      >
        <Icon name="close" />
      </button>
    {/if}
  </div>
</search>

<style>
  /* A chip is 24px tall inside the field, whatever its height; its Remove button is still a full 44px to press. */
  .chip {
    min-height: 1.5rem;
  }

  /* The keyboard's place, drawn around the whole box (chips included) when its field has it. */
  .search-box:has(#search-field:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: -1px;
  }
  #search-field:focus-visible {
    outline: none;
  }
</style>
