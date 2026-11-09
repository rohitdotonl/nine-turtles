<!--
  The search field (SPEC section 14), above the item list. A search icon and
  a tuning (sliders) icon sit together. What's searched shows as chips inside
  the field: where you are to begin with (`in: Tech`), then anything picked in
  the Search options popover. Each chip has a
  button that removes it; Backspace in an empty field removes the last one.
  The panel and the chips always match, since both show the same `query`.

  Enter searches straight away; otherwise the search follows a moment after
  typing stops. Tab moves from the field into the open panel.
  Escape is the app's: it closes search and returns you to where you were.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Feed, Folder } from "./shapes";
  import {
    chipsFor,
    scopeName,
    withoutChip,
    type Chip,
    type Query,
    type Scope,
  } from "./search";

  let {
    query,
    feeds,
    folders,
    here,
    found = "",
    onChange,
  }: {
    query: Query;
    feeds: Feed[];
    folders: Folder[];
    /** Where search started: its row in the options reads "This list". */
    here: Scope;
    /** How many the search found ("28 results"), empty until known; the options repeat it only while they cover the list's own line. */
    found?: string;
    /** The query changed; `now` when the search should follow at once, not after a pause in typing. */
    onChange: (query: Query, now: boolean) => void;
  } = $props();

  let field: HTMLInputElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let optionsButton: HTMLButtonElement | undefined = $state();
  let panelOpen = $state(false);
  /** The open options hide the list's own count line ("6 results"): only then do they repeat it, so the count is on screen once. */
  let countHidden = $state(false);

  /** Whether the open options cover the count line above the results, by where the two are drawn now. */
  function measureCount() {
    const line = document.querySelector("[data-result-count]");
    if (!panelOpen || !found || !panel || !line) {
      countHidden = false;
      return;
    }
    const words = document.createRange();
    words.selectNodeContents(line);
    const text = words.getBoundingClientRect();
    const menu = panel.getBoundingClientRect();
    countHidden = text.right > menu.left - 8 && text.bottom > menu.top && text.top < menu.bottom;
  }
  $effect(() => {
    void [panelOpen, found, panel];
    measureCount();
  });

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
  let resting = $derived(!inside && !panelOpen && query.words.trim() === "" && chips.length === 1 && chips[0]?.key === "scope");
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

  function remove(chip: Chip) {
    onChange(withoutChip(query, chip.key), true);
    field?.focus();
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      onChange({ ...query, words: query.words.trim() }, true);
    } else if (event.key === "Tab" && !event.shiftKey && panelOpen) {
      // Tab moves from the field into the options, onto the place being searched.
      const first = panel?.querySelector<HTMLElement>('input[name="search-in"]:checked') ?? panel?.querySelector<HTMLElement>("input");
      if (first) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === "Backspace" && field?.selectionStart === 0 && field.selectionEnd === 0) {
      const last = chips[chips.length - 1];
      if (!last) return;
      event.preventDefault();
      remove(last);
    }
  }

  /** A scope as one comparable value, to tell which row holds. */
  function scopeValue(scope: Scope): string {
    if (scope.kind === "all") return "all";
    if (scope.kind === "view") return `view:${scope.view}`;
    return `${scope.kind}:${scope.id}`;
  }

  let hereValue = $derived(scopeValue(here));
  let scopeNow = $derived(scopeValue(query.scope));

  function chooseScope(scope: Scope) {
    onChange({ ...query, scope }, true);
  }
</script>

<svelte:window
  onpointerup={pressEnded}
  onresize={measureCount}
  onpointercancel={pressEnded}
  onpointerdown={(event) => {
    // A press anywhere outside the search closes its options, as a popover does.
    if (panelOpen && !searchElement?.contains(event.target as Node)) panelOpen = false;
  }}
/>

<!-- svelte-ignore a11y_no_static_element_interactions: the pointer handler only notes a press; it acts on nothing. -->
<search
  class="relative mb-2"
  onfocusin={() => (inside = true)}
  onfocusout={(event) => {
    if (pressing || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    inside = false;
    // The keyboard left the search: its options close behind it, so they never cover where it went.
    if (event.relatedTarget) panelOpen = false;
  }}
  onkeydown={(event) => {
    // Escape closes the options first, back to their button; the next Escape closes the search.
    if (event.key === "Escape" && panelOpen) {
      event.preventDefault();
      event.stopPropagation();
      panelOpen = false;
      optionsButton?.focus();
    }
  }}
  bind:this={searchElement}
  onpointerdown={() => (pressing = true)}
>
  <!-- The whole box acts as the field: a click anywhere in it (not on a chip's or the options button) puts you in the field. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="search-box search-capsule relative flex min-w-0 cursor-text items-center gap-1 pl-3"
    onclick={(event) => {
      if (event.target === event.currentTarget) field?.focus();
    }}
  >
    <!-- The one search field's look, shared with the sidebar's find field (decision 0051). -->
    <span class="flex w-4 shrink-0 justify-center text-muted"><Icon name="search" size={14} /></span>
    <!--
      One line for the usual one or two chips: they shrink and end in "…" (their whole text is in their
      tooltip and their Remove button's name). With more, the row wraps so every chip stays readable.
    -->
    <div class={["flex min-w-0 flex-1 items-center gap-1", chips.length > 2 && "flex-wrap"]}>
      {#each shownChips as chip (chip.key)}
        <span class={["chip my-1.5 flex min-w-0 shrink items-center rounded-md bg-[var(--tone)] pl-2 text-small whitespace-nowrap", chips.length > 2 ? "max-w-full" : "max-w-[60%]"]}>
          <!-- Plain words, as the options menu names the filter. -->
          <span class="min-w-0 truncate" title={chip.label}>{chip.label}</span>
          <button type="button" aria-label="Remove {chip.label}" onclick={() => remove(chip)} class="-my-2.5 -mr-2 -ml-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
            <Icon name="close" size={14} />
          </button>
        </span>
      {/each}
      <label for="search-field" class="sr-only">Search</label>
      <input
        id="search-field"
        bind:this={field}
        type="text"
        value={query.words}
        oninput={typed}
        onkeydown={keydown}
        placeholder={shownChips.length > 0 ? "" : "Search"}
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
        <Icon name="close" size={16} />
      </button>
    {/if}
    <!-- Inside the box, at its end: it belongs to this search, and isn't mistaken for a second field. -->
    <button
      type="button"
      bind:this={optionsButton}
      aria-expanded={panelOpen}
      aria-controls="search-options"
      aria-label="Search options"
      title="Search options"
      onclick={() => (panelOpen = !panelOpen)}
      class={["flex size-(--search-height) shrink-0 cursor-pointer items-center justify-center self-start", panelOpen ? "text-ink" : "text-ink-2"]}
    >
      <!-- Open, the icon sits on a small rounded tone, like a pressed toolbar button. -->
      <span class={["flex size-7 items-center justify-center rounded-md", panelOpen && "bg-[var(--tone)]"]}><Icon name="sliders" size={18} /></span>
    </button>
    <!--
      A popover under the options button, drawn as a menu (decision 0039): two
      short sections of rows (decision 0189), a checkmark at the start of each one that holds, as a
      Mac menu shows its choices. Each row is a real radio button or tick box
      under the whole row, so keyboards and screen readers get the usual
      control. It floats over the list rather than pushing it down. Its name
      is a label rather than a heading of its own.
    -->
    <div
      id="search-options"
      role="group"
      aria-labelledby="search-options-name"
      bind:this={panel}
      hidden={!panelOpen}
      class="floating search-options absolute top-full right-0 z-20 mt-1 w-[min(17rem,100%)] min-w-60 cursor-auto p-1.5 text-ui"
    >
      <p id="search-options-name" class="sr-only">Search options</p>
      <fieldset class="min-w-0">
        <legend class="menu-head">Search in</legend>
        {#if hereValue !== "all"}
          <label class="menu-row">
            <input type="radio" name="search-in" checked={scopeNow === hereValue} onchange={() => chooseScope(here)} />
            <span class="menu-check"><Icon name="check" size={16} /></span>
            <span class="min-w-0 flex-1 truncate">{scopeName(here, library)}</span>
            <span class="shrink-0 text-meta text-muted">This list</span>
          </label>
        {/if}
        <label class="menu-row">
          <input type="radio" name="search-in" checked={scopeNow === "all"} onchange={() => chooseScope({ kind: "all" })} />
          <span class="menu-check"><Icon name="check" size={16} /></span>
          <span class="min-w-0 flex-1 truncate">Everything</span>
        </label>
      </fieldset>
      <!-- In the Starred list, Starred would only repeat This list. -->
      {#if scopeNow !== "view:starred"}
        <div role="separator" class="mx-2 my-1.5 h-px bg-ink/10"></div>
        <fieldset class="min-w-0">
          <legend class="menu-head">Show only</legend>
          <label class="menu-row">
            <input type="checkbox" checked={query.starred} onchange={(event) => onChange({ ...query, starred: event.currentTarget.checked }, true)} />
            <span class="menu-check"><Icon name="check" size={16} /></span>
            <span class="flex-1">Starred</span>
          </label>
        </fieldset>
      {/if}
      <!--
        How many were found, at the menu's foot, only while the menu covers the line above the
        results that says it (measured, so the count is never on screen twice), so changing a filter
        still shows its effect (decision 0054). Screen readers already hear that line, so this copy
        is for the eyes only.
      -->
      {#if found && countHidden}
        <div aria-hidden="true">
          <div class="mx-2 my-1.5 h-px bg-ink/10"></div>
          <p class="px-3 pt-0.5 pb-1 text-meta text-muted">{found}</p>
        </div>
      {/if}
    </div>
  </div>
</search>

<style>
  /* The options as a menu: small section names, then rows with a checkmark at the start of each one that holds. */
  .menu-head {
    padding: 0.375rem 0.75rem 0.25rem;
    color: var(--muted);
    font-size: var(--text-meta);
    font-weight: 600;
  }
  .menu-row {
    position: relative;
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.5rem;
    padding-inline: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    color: var(--ink);
    cursor: pointer;
  }
  @media (pointer: fine) {
    .menu-row {
      min-height: 2.25rem;
    }
  }
  @media (hover: hover) {
    .menu-row:hover {
      background-color: var(--hover);
    }
  }
  .menu-row > input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .menu-check {
    display: flex;
    width: 1.25rem;
    flex-shrink: 0;
    justify-content: center;
    visibility: hidden;
  }
  /* What holds: a checkmark, and semibold words, so it never shows by color alone. */
  .menu-row:has(> input:checked) {
    font-weight: 600;
  }
  .menu-row:has(> input:checked) > .menu-check {
    visibility: visible;
  }
  .menu-row:has(> input:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: -2px;
  }

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
