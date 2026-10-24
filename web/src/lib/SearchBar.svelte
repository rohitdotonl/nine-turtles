<!--
  The search field (SPEC section 14), above the item list. A search icon and
  a tuning (sliders) icon sit together. What's searched shows as chips inside
  the field: where you are to begin with (`in: Tech`), then any filter typed
  (`is:starred`, shown in plain words as "Starred") or picked in the Search
  options popover. Each chip has a
  button that removes it; Backspace in an empty field removes the last one.
  The panel and the chips always match, since both show the same `query`.

  While typing, filters are suggested under the field (↓ and ↑ choose, Enter
  takes one). Enter searches straight away; otherwise the search follows a
  moment after typing stops. Tab moves from the field into the open panel.
  Escape is the app's: it closes search and returns you to where you were.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Feed, Folder } from "./feeds";
  import {
    chipsFor,
    replaceLastWord,
    scopeName,
    suggestions as suggestionsFor,
    takeFilters,
    withoutChip,
    type Chip,
    type Query,
    type Scope,
    type Suggestion,
  } from "./search";

  let {
    query,
    feeds,
    folders,
    here,
    onChange,
  }: {
    query: Query;
    feeds: Feed[];
    folders: Folder[];
    /** Where search started: its row in the options reads "This list". */
    here: Scope;
    /** The query changed; `now` when the search should follow at once, not after a pause in typing. */
    onChange: (query: Query, now: boolean) => void;
  } = $props();

  let field: HTMLInputElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let optionsButton: HTMLButtonElement | undefined = $state();
  let panelOpen = $state(false);
  let problem = $state("");
  let active = $state(-1);
  /** Suggestions are offered only while the reader types in the field. */
  let offering = $state(false);

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
  let offered: Suggestion[] = $derived(offering ? suggestionsFor(query.words, library) : []);

  export function focus() {
    field?.focus();
  }

  function typed(event: Event) {
    const words = (event.currentTarget as HTMLInputElement).value;
    const result = takeFilters({ ...query, words }, library, false);
    problem = result.problem ?? "";
    offering = true;
    active = -1;
    // A filter that just became a chip searches at once; plain words after a pause.
    const tookFilter = JSON.stringify(chipsFor(result.query, library)) !== JSON.stringify(chips);
    onChange(result.query, tookFilter);
  }

  function choose(suggestion: Suggestion) {
    if ("text" in suggestion) {
      onChange({ ...query, words: replaceLastWord(query.words, suggestion.text) }, false);
    } else {
      onChange(suggestion.query({ ...query, words: replaceLastWord(query.words, "").trimEnd() }), true);
      problem = "";
    }
    active = -1;
    field?.focus();
  }

  /** The × in the field: the typed words go, and the search follows at once. */
  function clear() {
    problem = "";
    offering = false;
    active = -1;
    onChange({ ...query, words: "" }, true);
    field?.focus();
  }

  function remove(chip: Chip) {
    onChange(withoutChip(query, chip.key), true);
    field?.focus();
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (offered.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      active = (active + step + offered.length + 1) % (offered.length + 1);
      if (active === offered.length) active = -1;
    } else if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = offered[active];
      if (suggestion) {
        choose(suggestion);
        return;
      }
      const result = takeFilters(query, library, true);
      problem = result.problem ?? "";
      offering = false;
      onChange(result.query, true);
    } else if (event.key === "Tab" && !event.shiftKey && panelOpen) {
      // Tab moves from the field into the options, onto the place being searched.
      const first = panel?.querySelector<HTMLElement>('input[name="search-in"]:checked') ?? panel?.querySelector<HTMLElement>("input, select");
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

  /** The scope list's value for a scope, and back. */
  function scopeValue(scope: Scope): string {
    if (scope.kind === "all") return "all";
    if (scope.kind === "view") return `view:${scope.view}`;
    return `${scope.kind}:${scope.id}`;
  }

  function scopeFrom(value: string): Scope {
    const [kind, rest] = value.split(":");
    if (kind === "view") return { kind: "view", view: rest === "starred" ? "starred" : "unread" };
    if (kind === "feed" || kind === "folder") return { kind, id: Number(rest) };
    return { kind: "all" };
  }

  let hereValue = $derived(scopeValue(here));
  let scopeNow = $derived(scopeValue(query.scope));

  function chooseScope(scope: Scope) {
    onChange({ ...query, scope }, true);
  }

  /** "Published": presets count back from today; Custom shows two dates. */
  const WHENS = [
    { value: "any", label: "Any time" },
    { value: "week", label: "Past week" },
    { value: "month", label: "Past month" },
    { value: "custom", label: "Custom" },
  ] as const;
  type When = (typeof WHENS)[number]["value"];

  /** The day `days` before today, as `YYYY-MM-DD` in local time. */
  function daysAgo(days: number): string {
    const day = new Date();
    day.setDate(day.getDate() - days);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  }

  /** Custom was chosen, so its dates show even before one is picked. */
  let customChosen = $state(false);
  // Once the options close with no dates set, Custom no longer holds.
  $effect(() => {
    if (!panelOpen && !query.after && !query.before) customChosen = false;
  });
  let whenNow: When = $derived.by(() => {
    if (customChosen) return "custom";
    if (!query.after && !query.before) return "any";
    if (!query.before && query.after === daysAgo(7)) return "week";
    if (!query.before && query.after === daysAgo(30)) return "month";
    return "custom";
  });

  function chooseWhen(when: When) {
    customChosen = when === "custom";
    // "After" is strictly after: after 7 days ago is the last seven days, today included.
    if (when === "any") onChange({ ...query, after: "", before: "" }, true);
    else if (when === "week") onChange({ ...query, after: daysAgo(7), before: "" }, true);
    else if (when === "month") onChange({ ...query, after: daysAgo(30), before: "" }, true);
  }
</script>

<svelte:window
  onpointerup={pressEnded}
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
    class="search-box relative flex min-h-11 min-w-0 cursor-text items-center gap-1 rounded-lg border border-transparent bg-[var(--tone)] pl-3"
    onclick={(event) => {
      if (event.target === event.currentTarget) field?.focus();
    }}
  >
    <span class="shrink-0 text-muted"><Icon name="search" size={16} /></span>
    <!--
      One line for the usual one or two chips: they shrink and end in "…" (their whole text is in their
      tooltip and their Remove button's name). With more, the row wraps so every chip stays readable.
    -->
    <div class={["flex min-w-0 flex-1 items-center gap-1", chips.length > 2 && "flex-wrap"]}>
      {#each shownChips as chip (chip.key)}
        <span class={["my-1.5 flex min-w-0 shrink items-center rounded bg-[var(--tone)] pl-2 text-small whitespace-nowrap", chips.length > 2 ? "max-w-full" : "max-w-[60%]"]}>
          <!-- Plain words, as the options menu names the filter; how it's typed is its tooltip and its description (decision 0047). -->
          <span class="min-w-0 truncate" title={chip.typed ?? chip.label}>{chip.label}</span>
          {#if chip.typed}<span id="chip-typed-{chip.key}" hidden>{chip.typed}</span>{/if}
          <button type="button" aria-label="Remove {chip.label}" aria-describedby={chip.typed ? `chip-typed-${chip.key}` : undefined} onclick={() => remove(chip)} class="-my-2 -mr-2 -ml-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
            <Icon name="close" size={14} />
          </button>
        </span>
      {/each}
      <label for="search-field" class="sr-only">Search</label>
      <input
        id="search-field"
        bind:this={field}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={offered.length > 0}
        aria-controls="search-suggestions"
        aria-activedescendant={active >= 0 ? `search-suggestion-${active}` : undefined}
        aria-describedby="search-problem"
        value={query.words}
        oninput={typed}
        onkeydown={keydown}
        onblur={() => (offering = false)}
        placeholder={shownChips.length > 0 ? "" : "Search"}
        autocomplete="off"
        spellcheck="false"
        class="-my-px min-h-11 min-w-16 flex-1 basis-16 bg-transparent px-1 placeholder:text-muted"
      />
    </div>
    {#if query.words !== ""}
      <!-- Once there's text, an × empties the field (the chips stay) and leaves the keyboard in it. -->
      <button
        type="button"
        aria-label="Clear search"
        title="Clear search"
        onclick={clear}
        class="flex size-11 shrink-0 cursor-pointer items-center justify-center self-start text-ink-2"
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
      class={["flex size-11 shrink-0 cursor-pointer items-center justify-center self-start", panelOpen ? "text-ink" : "text-ink-2"]}
    >
      <!-- Open, the icon sits on a small rounded tone, like a pressed toolbar button. -->
      <span class={["flex size-8 items-center justify-center rounded-md", panelOpen && "bg-[var(--tone)]"]}><Icon name="sliders" size={18} /></span>
    </button>
    <!--
      A popover under the options button, drawn as a menu (decision 0039): three
      sections of rows, a checkmark at the start of each one that holds, as a
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
      class="floating absolute top-full right-0 z-20 mt-1 w-[min(17rem,100%)] min-w-60 cursor-auto p-1.5 text-ui"
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
          <span class="min-w-0 flex-1 truncate">All feeds</span>
        </label>
        {#if scopeNow !== "all" && scopeNow !== hereValue}
          <!-- Somewhere else, chosen below or typed as feed: or folder:. -->
          <label class="menu-row">
            <input type="radio" name="search-in" checked onchange={() => {}} />
            <span class="menu-check"><Icon name="check" size={16} /></span>
            <span class="min-w-0 flex-1 truncate">{scopeName(query.scope, library)}</span>
          </label>
        {/if}
        <!--
          Any other feed or folder: drawn as a menu's submenu row, a trailing › that leads on to a
          second list (the device's own), as a Mac menu does, rather than a drop-down among the
          checkmarks. Short words, which wrap rather than cut off on a narrow screen (decision 0047).
        -->
        <span class="menu-row">
          <span class="menu-check"></span>
          <span class="min-w-0 flex-1 py-1.5 leading-snug">Other feed or folder</span>
          <span class="shrink-0 text-muted"><Icon name="chevron-right" size={16} /></span>
          <select
            aria-label="Search in another feed or folder"
            value={scopeNow}
            onchange={(event) => {
              // Kept on the scope being searched, so the arrow keys step on from it.
              const value = event.currentTarget.value;
              if (value) chooseScope(scopeFrom(value));
            }}
            class="menu-select"
          >
            <option value="" disabled>Other feed or folder</option>
            <option value="view:unread">Unread</option>
            <option value="view:starred">Starred</option>
            {#if folders.length > 0}
              <optgroup label="Folders">
                {#each folders as folder (folder.id)}
                  <option value="folder:{folder.id}">{folder.name}</option>
                {/each}
              </optgroup>
            {/if}
            <optgroup label="Feeds">
              {#each feeds as feed (feed.id)}
                <option value="feed:{feed.id}">{feed.title}</option>
              {/each}
            </optgroup>
          </select>
        </span>
      </fieldset>
      <div role="separator" class="mx-2 my-1.5 h-px bg-ink/10"></div>
      <fieldset class="min-w-0">
        <legend class="menu-head">Show only</legend>
        <label class="menu-row">
          <input type="checkbox" checked={query.unread} onchange={(event) => onChange({ ...query, unread: event.currentTarget.checked }, true)} />
          <span class="menu-check"><Icon name="check" size={16} /></span>
          <span class="flex-1">Unread</span>
        </label>
        <label class="menu-row">
          <input type="checkbox" checked={query.starred} onchange={(event) => onChange({ ...query, starred: event.currentTarget.checked }, true)} />
          <span class="menu-check"><Icon name="check" size={16} /></span>
          <span class="flex-1">Starred</span>
        </label>
      </fieldset>
      <div role="separator" class="mx-2 my-1.5 h-px bg-ink/10"></div>
      <fieldset class="min-w-0">
        <legend class="menu-head">Published</legend>
        {#each WHENS as when (when.value)}
          <label class="menu-row">
            <input type="radio" name="search-when" value={when.value} checked={whenNow === when.value} onchange={() => chooseWhen(when.value)} />
            <span class="menu-check"><Icon name="check" size={16} /></span>
            <span class="flex-1">{when.label}</span>
          </label>
        {/each}
        {#if whenNow === "custom"}
          <div class="grid grid-cols-2 gap-2 px-2 pt-1 pb-1.5">
            <label class="flex min-w-0 flex-col gap-1">
              <span class="text-meta text-muted">After</span>
              <input
                type="date"
                value={query.after}
                aria-label="Published after"
                onchange={(event) => onChange({ ...query, after: event.currentTarget.value }, true)}
                class="field w-full min-w-0 px-2 text-small pointer-fine:min-h-9"
              />
            </label>
            <label class="flex min-w-0 flex-col gap-1">
              <span class="text-meta text-muted">Before</span>
              <input
                type="date"
                value={query.before}
                aria-label="Published before"
                onchange={(event) => onChange({ ...query, before: event.currentTarget.value }, true)}
                class="field w-full min-w-0 px-2 text-small pointer-fine:min-h-9"
              />
            </label>
          </div>
        {/if}
      </fieldset>
    </div>
  </div>

  <ul id="search-suggestions" role="listbox" aria-label="Suggestions" hidden={offered.length === 0} class="mt-1 rounded-md border border-muted bg-paper py-1">
    {#each offered as suggestion, index (suggestion.label)}
      <!-- Chosen with the mouse on press, before the field loses the keyboard's place. -->
      <li
        id="search-suggestion-{index}"
        role="option"
        aria-selected={index === active}
        onmousedown={(event) => {
          event.preventDefault();
          choose(suggestion);
        }}
        class={["flex min-h-11 cursor-default items-center border-l-4 px-3 font-mono text-small", index === active ? "border-accent bg-tint-list" : "border-transparent"]}
      >
        {suggestion.label}
      </li>
    {/each}
  </ul>

  <p id="search-problem" role="status" class="mt-1 text-small empty:sr-only">{problem}</p>

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
  .menu-row > input,
  .menu-select {
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
  .menu-row:has(> :is(input, select):focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: -2px;
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
