<!--
  The `?` shortcut list (SPEC section 19). A native dialog: it keeps the
  keyboard inside while open, and Escape closes it. Shortcuts for features
  that don't exist yet aren't listed.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { SHORTCUT_GROUPS, keyCap, shortcutMatches, shortcutsFor } from "./keyboard";

  let { open = $bindable(), river = false }: { open: boolean; /** River mode: Go to Unread and Mark all as read aren't listed. */ river?: boolean } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let heading: HTMLHeadingElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();
  /** The list has scrolled under the title: a hairline parts them. */
  let scrolled = $state(false);
  /** More of the list lies below what's shown: a hairline marks the foot's edge, so a row cut there reads as scrolling, not clipping. */
  let more = $state(false);

  function measure() {
    if (!list) return;
    scrolled = list.scrollTop > 0;
    more = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
  }

  const FILTERS: [string, string][] = [
    ["is:unread", "Unread items only"],
    ["is:starred", "Starred items only"],
    ["feed:name", "One feed"],
    ["folder:name", "One folder"],
    ["after:YYYY-MM-DD", "Published after that day"],
    ["before:YYYY-MM-DD", "Published before that day"],
  ];

  /** The groups in each of the two columns; the search filters close the second. */
  const COLUMNS: (typeof SHORTCUT_GROUPS)[number][][] = [
    ["Reading", "Getting around"],
    ["Tidying up", "Anywhere"],
  ];

  /** What's typed in the find field: the list shows only the shortcuts that fit it (decision 0062). */
  let find = $state("");
  let field: HTMLInputElement | undefined = $state();
  const wanted = $derived(find.trim().toLowerCase());
  const shown = $derived(shortcutsFor(river).filter((each) => shortcutMatches(each, find)));
  const filtersShown = $derived(FILTERS.filter(([filter, meaning]) => wanted === "" || filter.includes(wanted) || meaning.toLowerCase().includes(wanted)));
  const nothing = $derived(shown.length === 0 && filtersShown.length === 0);
  $effect(() => {
    void find;
    measure();
  });

  /**
   * Escape empties the find field first, wherever the keyboard is in the list, and puts the keyboard
   * back in the field; pressed again, it closes the list. A letter typed while the list is open, outside
   * the field, starts a find: no need to Tab there first.
   */
  function typed(event: KeyboardEvent) {
    if (event.key === "Escape" && find !== "") {
      event.preventDefault();
      find = "";
      field?.focus();
      return;
    }
    // Space stays with the button or list it's pressed on.
    if (event.target === field || event.key.length !== 1 || event.key === " " || event.ctrlKey || event.metaKey || event.altKey) return;
    field?.focus();
  }

  $effect(() => {
    if (open && !dialog?.open) {
      dialog?.showModal();
      // The keyboard starts on the title (screen readers start there), so the X
      // isn't ringed the moment the list opens; the title draws no ring of its
      // own, since it can't be pressed (app.css; decision 0042).
      heading?.focus();
      measure();
    }
    if (!open && dialog?.open) dialog.close();
    if (!open) find = "";
  });
</script>

<!--
  Laid out like a reference card: what each shortcut does on the left, its
  keys on the right, in four small groups, two columns side by side on a
  wide screen, the search filters under the right-hand ones, so at 800px tall
  it fits without scrolling, 48px clear of the window's top and foot. On a
  phone-narrow window it's a screen of its own, as every sheet is there. The title and its close button stay
  put while the list scrolls; a hairline under them shows only once the list
  has scrolled, and one at the foot only while more lies below.
-->
<svelte:window onresize={measure} />

<dialog
  bind:this={dialog}
  aria-labelledby="shortcuts-heading"
  onclose={() => (open = false)}
  onkeydown={typed}
  class="shortcuts floating dimmed m-auto w-[min(52rem,calc(100vw-2rem))] overflow-hidden p-0 text-ink"
>
  <!-- A 16px band of paper under the list, so a row cut by its foot sits above a hairline, never against the card's edge. -->
  <div class="shortcuts-body flex flex-col pb-4">
    <!--
      The title, a find field and the close button in one line on a wide screen; on a narrow one
      the field takes a line of its own under them (decision 0062).
    -->
    <div class={["shortcuts-head grid shrink-0 items-center gap-x-4 border-b pr-4 pl-6", scrolled ? "border-ink/10" : "border-transparent"]}>
      <h2 id="shortcuts-heading" tabindex="-1" bind:this={heading} class="sheet-title [grid-area:title]">Keyboard shortcuts</h2>
      <div class="relative [grid-area:find]">
        <span class="pointer-events-none absolute top-0 left-3 flex h-(--search-height) w-4 items-center justify-center text-muted"><Icon name="search" size={14} /></span>
        <label for="shortcut-find" class="sr-only">Find a shortcut</label>
        <input
          id="shortcut-find"
          type="search"
          bind:this={field}
          bind:value={find}
          placeholder="Find a shortcut"
          autocomplete="off"
          spellcheck="false"
          aria-describedby="shortcut-count"
          class="search-capsule w-full pr-3 pl-[38px]"
        />
      </div>
      <button type="button" onclick={() => (open = false)} aria-label="Close" title="Close (Esc)" class="btn-quiet btn-icon [grid-area:close]"><Icon name="close" size={18} /></button>
    </div>
    <p id="shortcut-count" role="status" class="sr-only">{wanted === "" ? "" : nothing ? "No shortcut matches." : `${shown.length + filtersShown.length} found.`}</p>
    <!-- A Tab stop of its own, so the list can be scrolled with the keyboard (axe: scrollable-region-focusable). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      tabindex="0"
      role="region"
      aria-label="Shortcuts"
      bind:this={list}
      onscroll={measure}
      class={["shortcuts-list min-h-0 overflow-y-auto border-b px-6 pt-2 pb-4 shortcut-region", more ? "border-ink/10" : "border-transparent"]}
    >
      <!--
        Two columns on a wide screen, each its own stack, so a short group never
        leaves a hole beside a long one: reading and getting around on the
        left; tidying up, anywhere and the search filters on the right, where
        there's room (decision 0049). On a narrow screen they stack in that order.
      -->
      {#if nothing}
        <p class="py-6 text-center text-small text-muted">No shortcut matches “{find.trim()}”.</p>
      {/if}
      <div class="grid gap-x-10 gap-y-6 md:grid-cols-2">
        {#each COLUMNS as column, side (side)}
          <div class="flex min-w-0 flex-col gap-6">
            {#each column.filter((each) => shown.some((shortcut) => shortcut.group === each)) as group (group)}
              {@const index = SHORTCUT_GROUPS.indexOf(group)}
              <section aria-labelledby={`keys-${index}`}>
                <h3 id={`keys-${index}`} class="mb-1 text-meta font-semibold text-muted">{group}</h3>
                <table class="w-full text-left text-small">
                  <tbody>
                    {#each shown.filter((each) => each.group === group) as shortcut (shortcut.action)}
                      <tr class="border-b border-ink/[0.07] last:border-0">
                        <td class="py-1.5 pr-4 align-middle">{shortcut.action}</td>
                        <!--
                          "g then u" is two presses: a cap for each key, with "then" between them.
                          Each shortcut stays whole; on a narrow phone the alternatives wrap at the slashes.
                          Caps are printed as a Mac prints them: capital letters, ⇧ for Shift (screen readers
                          hear "Shift A"), and a true minus sign on the - key (decisions 0045, 0055).
                        -->
                        <td class="py-1.5 text-right align-middle whitespace-nowrap">
                          {#each shortcut.keys as key, index (key)}{#if index > 0}{" "}{/if}<span class="whitespace-nowrap"
                              >{#if index > 0}<span class="text-muted">{"/ "}</span>{/if}{#each key.split(" then ") as press, step (step)}{@const cap = keyCap(press)}{#if step > 0}<span
                                    class="text-[0.75rem] text-muted">{" then "}</span
                                  >{/if}{#if cap.spoken}<kbd class="key" aria-hidden="true">{cap.cap}</kbd><span
                                    class="sr-only">{cap.spoken}</span
                                  >{:else}<kbd class="key">{cap.cap}</kbd>{/if}{/each}</span
                            >{/each}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </section>
            {/each}
            {#if side === 1 && filtersShown.length > 0}
              <section aria-labelledby="filters-heading">
                <h3 id="filters-heading" class="text-meta font-semibold text-muted">Search filters</h3>
                <p class="mt-0.5 mb-1 text-small text-muted">Type these in the search field; each becomes a chip. Names with spaces go in quotes.</p>
                <table class="w-full text-left text-small">
                  <tbody>
                    {#each filtersShown as [filter, meaning] (filter)}
                      <tr class="border-b border-ink/[0.07] last:border-0">
                        <td class="w-px py-1.5 pr-4 whitespace-nowrap sm:pr-8"><code class="font-mono text-meta">{filter}</code></td>
                        <td class="py-1.5">{meaning}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </section>
            {/if}
          </div>
        {/each}
      </div>
      <!-- A footer under both columns, the full width, so it never ends one column early or lands mid-list on a phone (decision 0052). -->
      <p class="mt-4 text-meta text-muted">Tab, Enter and Escape always work too. Shortcuts don't fire while you're typing in a field.</p>
    </div>
  </div>
</dialog>

<style>
  /* No taller than 720px, and always at least 48px clear of the window's top and foot (decision 0049). */
  .shortcuts,
  .shortcuts-body {
    max-height: min(45rem, 100dvh - 6rem);
  }
  /*
    On a phone-narrow window (the width at which the app shows one screen at
    a time, layout.ts) it's a screen of its own, as Add a feed and Edit feed
    are there: no card, no dim around it, nothing behind it showing past its
    edge (decision 0049).
  */
  @media (width < 56rem) {
    .shortcuts {
      inset: 0;
      width: 100%;
      max-width: none;
      height: 100dvh;
      margin: 0;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      /* A screen, not something floating: the page's own color, by night too (decision 0052). */
      background-color: var(--paper);
    }
    .shortcuts,
    .shortcuts-body {
      max-height: 100dvh;
    }
    .shortcuts-body {
      height: 100%;
    }
    /* The phone's one top line and one 20px margin, the X where every phone screen has it. */
    .shortcuts-head {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        "title close"
        "find find";
      min-height: var(--bar-h);
      padding-inline: 1.25rem 0.625rem;
      padding-bottom: 0.5rem;
    }
    .shortcuts-head > :nth-child(2) {
      margin-right: 0.625rem;
    }
    .shortcuts-list {
      flex: 1 1 auto;
      padding-inline: 1.25rem;
    }
  }
  /* On a wide window the title, the find field and the X share one line. */
  @media (width >= 56rem) {
    .shortcuts-head {
      grid-template-columns: auto minmax(0, 15rem) auto;
      grid-template-areas: "title find close";
      justify-content: space-between;
      min-height: 4rem;
    }
  }
  /* The list's own Tab stop rings just inside its edge, so the card's edge never clips the outline. */
  .shortcut-region:focus-visible {
    outline-offset: -2px;
  }
</style>
