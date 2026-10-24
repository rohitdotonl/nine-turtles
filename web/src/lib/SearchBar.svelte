<!--
  The search field (SPEC section 14), above the item list. A search icon and
  a tuning (sliders) icon sit together. What's searched shows as chips inside
  the field: where you are to begin with (`in: Tech`), then any filter typed
  (`is:starred`) or picked in the Search options panel. Each chip has a
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
    /** Where search started: the panel's scope list says "(here)" beside it. */
    here: Scope;
    /** The query changed; `now` when the search should follow at once, not after a pause in typing. */
    onChange: (query: Query, now: boolean) => void;
  } = $props();

  let field: HTMLInputElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
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
      // Tab moves from the field into the options panel.
      const first = panel?.querySelector<HTMLElement>("select, input");
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

  function hereMark(scope: Scope): string {
    return scopeValue(scope) === scopeValue(here) ? " (here)" : "";
  }
</script>

<svelte:window onpointerup={pressEnded} onpointercancel={pressEnded} />

<!-- svelte-ignore a11y_no_static_element_interactions: the pointer handler only notes a press; it acts on nothing. -->
<search
  class="relative mb-2"
  onfocusin={() => (inside = true)}
  onfocusout={(event) => {
    if (!pressing && !event.currentTarget.contains(event.relatedTarget as Node | null)) inside = false;
  }}
  bind:this={searchElement}
  onpointerdown={() => (pressing = true)}
>
  <!-- The whole box acts as the field: a click anywhere in it (not on a chip's or the options button) puts you in the field. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div
    class="search-box flex min-h-11 min-w-0 cursor-text items-center gap-1 rounded-lg border border-muted bg-paper pl-3"
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
          <span class="min-w-0 truncate" title={chip.label}>{chip.label}</span>
          <button type="button" aria-label="Remove {chip.label}" onclick={() => remove(chip)} class="-my-2 -mr-2 -ml-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
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
        placeholder={resting ? `Search ${chips[0]?.label.slice("in: ".length)}` : shownChips.length > 0 ? "" : "Search"}
        autocomplete="off"
        spellcheck="false"
        class="-my-px min-h-11 min-w-16 flex-1 basis-16 bg-transparent px-1 placeholder:text-muted"
      />
    </div>
    <!-- Inside the box, at its end: it belongs to this search, and isn't mistaken for a second field. -->
    <button
      type="button"
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

  <!-- Above the list's heading, so its name is a label rather than a heading of its own. -->
  <div
    id="search-options"
    role="group"
    aria-labelledby="search-options-name"
    bind:this={panel}
    hidden={!panelOpen}
    class="mt-2 rounded-lg border border-ink/10 bg-paper p-4"
  >
    <p id="search-options-name" class="text-small font-semibold">Search options</p>
    <div class="mt-3 flex flex-col gap-3">
      <label class="flex flex-col gap-1.5">
        <span class="text-small text-ink-2">Search in</span>
        <span class="relative block">
        <select
          value={scopeValue(query.scope)}
          onchange={(event) => onChange({ ...query, scope: scopeFrom(event.currentTarget.value) }, true)}
          class="field w-full appearance-none pr-9 text-ui pointer-fine:min-h-9"
        >
          <option value="all">All feeds{hereMark({ kind: "all" })}</option>
          <option value="view:unread">Unread{hereMark({ kind: "view", view: "unread" })}</option>
          <option value="view:starred">Starred{hereMark({ kind: "view", view: "starred" })}</option>
          {#if folders.length > 0}
            <optgroup label="Folders">
              {#each folders as folder (folder.id)}
                <option value="folder:{folder.id}">{folder.name}{hereMark({ kind: "folder", id: folder.id })}</option>
              {/each}
            </optgroup>
          {/if}
          <optgroup label="Feeds">
            {#each feeds as feed (feed.id)}
              <option value="feed:{feed.id}">{feed.title}{hereMark({ kind: "feed", id: feed.id })}</option>
            {/each}
          </optgroup>
        </select>
        <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-2"><Icon name="chevron-down" size={16} /></span>
        </span>
      </label>
      <div class="flex flex-wrap gap-x-6">
        <label class="flex min-h-11 items-center gap-2.5 text-small pointer-fine:min-h-9">
          <input type="checkbox" checked={query.unread} onchange={(event) => onChange({ ...query, unread: event.currentTarget.checked }, true)} class="size-[1.125rem]" />
          Unread only
        </label>
        <label class="flex min-h-11 items-center gap-2.5 text-small pointer-fine:min-h-9">
          <input type="checkbox" checked={query.starred} onchange={(event) => onChange({ ...query, starred: event.currentTarget.checked }, true)} class="size-[1.125rem]" />
          Starred only
        </label>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex min-w-0 flex-col gap-1.5">
          <span class="text-small text-ink-2">Published after</span>
          <input
            type="date"
            value={query.after}
            onchange={(event) => onChange({ ...query, after: event.currentTarget.value }, true)}
            class="field w-full min-w-0 text-ui pointer-fine:min-h-9"
          />
        </label>
        <label class="flex min-w-0 flex-col gap-1.5">
          <span class="text-small text-ink-2">Published before</span>
          <input
            type="date"
            value={query.before}
            onchange={(event) => onChange({ ...query, before: event.currentTarget.value }, true)}
            class="field w-full min-w-0 text-ui pointer-fine:min-h-9"
          />
        </label>
      </div>
    </div>
  </div>
</search>

<style>
  /* The keyboard's place, drawn around the whole box (chips included) when its field has it. */
  .search-box:has(input:focus-visible) {
    outline: 2px solid var(--ink);
    outline-offset: -1px;
  }
  .search-box input:focus-visible {
    outline: none;
  }
</style>
