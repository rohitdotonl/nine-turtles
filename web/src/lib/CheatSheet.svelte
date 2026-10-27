<!--
  The `?` shortcut list (SPEC section 19). A native dialog: it keeps the
  keyboard inside while open, and Escape closes it. Shortcuts for features
  that don't exist yet aren't listed.

  It only lists, until the reader presses Change keys… at its foot (or
  Settings › Keyboard opens it that way): then, in the same sheet, each key
  that can change becomes a button. Pressing one waits for the next key;
  a key another shortcut has is offered with Use it / Cancel, and the other
  is left with no key. Every change is saved at once, for the reader's
  account (decision 0110).
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import {
    SHORTCUT_GROUPS,
    bindingNamed,
    chooseKey,
    doesWords,
    holderOf,
    isChanged,
    keyCap,
    keyOf,
    keyWords,
    rebind,
    shortcutMatches,
    shortcutsFor,
    type Binding,
    type KeyMap,
  } from "./keyboard";
  import { chooseKeys, keys } from "./keys.svelte";

  let {
    open = $bindable(),
    river = false,
    editing = $bindable(false),
  }: {
    open: boolean;
    /** River mode: Go to Unread and Mark all as read aren't listed (while changing keys, everything is). */
    river?: boolean;
    /** Changing keys (decision 0110): each key that can change is a button. */
    editing?: boolean;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let heading: HTMLHeadingElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();
  let changeButton: HTMLButtonElement | undefined = $state();
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

  /**
   * The groups in each of the three columns; the search filters close the
   * last. Three since decision 0110 added keys: two no longer fit an
   * 800px-tall window.
   */
  const COLUMNS: (typeof SHORTCUT_GROUPS)[number][][] = [["Reading"], ["Getting around", "Anywhere"], ["Tidying up"]];

  /** What's typed in the find field: the list shows only the shortcuts that fit it (decision 0062). */
  let find = $state("");
  let field: HTMLInputElement | undefined = $state();
  const wanted = $derived(find.trim().toLowerCase());
  // While changing keys every shortcut is listed, river mode or not, so any key can be set.
  const shown = $derived(shortcutsFor(river && !editing, keys.chosen).filter((each) => shortcutMatches(each, find)));
  const filtersShown = $derived(editing ? [] : FILTERS.filter(([filter, meaning]) => wanted === "" || filter.includes(wanted) || meaning.toLowerCase().includes(wanted)));
  const nothing = $derived(shown.length === 0 && filtersShown.length === 0);
  const changedAny = $derived(Object.keys(keys.chosen).some((id) => isChanged(id, keys.chosen)));
  $effect(() => {
    void find;
    void editing;
    measure();
  });

  /** The key waiting to be pressed for a binding, by its name. */
  let waiting: string | undefined = $state();
  /** A key another binding has, offered to this one: Use it or Cancel. */
  let asking: { id: string; key: string; holder: Binding } | undefined = $state();
  /** Why the key just pressed can't be used, under the row that waits. */
  let problem: { id: string; text: string } | undefined = $state();
  /** What screen readers hear about each step. */
  let said = $state("");

  /** A sentence about a key, starting with a capital: "Shift+O already marks older as read." */
  const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  function say(text: string) {
    // The same words twice are still heard: empty the line first.
    said = "";
    void tick().then(() => (said = text));
  }

  async function focusBinding(id: string) {
    await tick();
    dialog?.querySelector<HTMLElement>(`[data-binding="${id}"]`)?.focus();
  }

  function startEditing() {
    editing = true;
    say("Changing keys. Choose a key to change it; Done when you've finished.");
    void tick().then(() => dialog?.querySelector<HTMLElement>("[data-binding]")?.focus());
  }

  function stopEditing() {
    clearPending();
    editing = false;
    say("");
    void tick().then(() => changeButton?.focus());
  }

  function clearPending() {
    waiting = undefined;
    asking = undefined;
    problem = undefined;
  }

  /** A key's button pressed: wait for the new key, or stop waiting if it was. */
  function choose(id: string) {
    if (waiting === id) {
      clearPending();
      say("Not changed.");
      return;
    }
    asking = undefined;
    problem = undefined;
    waiting = id;
    say(`Press the new key that ${doesWords(id)}. Escape cancels.`);
  }

  /** The next key pressed while one waits: it becomes the key, or says why it can't. */
  function pressedWhileWaiting(event: KeyboardEvent) {
    if (asking && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelAsking();
      return;
    }
    const id = waiting;
    if (!id) return;
    // Tab leaves for the next control, as it always does; nothing changes.
    if (event.key === "Tab") {
      clearPending();
      say("Not changed.");
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      clearPending();
      say("Not changed.");
      return;
    }
    const answer = chooseKey(event);
    if (!answer) return;
    if ("refused" in answer) {
      problem = { id, text: answer.refused };
      say(answer.refused);
      return;
    }
    offer(id, answer.key);
  }

  /** A key for a binding: given at once, or, if another binding has it, asked about first. */
  function offer(id: string, key: string) {
    waiting = undefined;
    problem = undefined;
    if (keyOf(id, keys.chosen) === key) {
      say(`Not changed: it's ${keyWords(key)} already.`);
      return;
    }
    const holder = holderOf(key, keys.chosen, id);
    if (holder) {
      asking = { id, key, holder };
      say(`${keyWords(key)} already ${doesWords(holder.id)}. Use it here instead?`);
      void tick().then(() => dialog?.querySelector<HTMLElement>("[data-use-it]")?.focus());
      return;
    }
    give(id, key);
  }

  function give(id: string, key: string) {
    const holder = holderOf(key, keys.chosen, id);
    asking = undefined;
    // "X now stars and unstars. Nothing marks older as read now."
    save(rebind(keys.chosen, id, key), `${keyWords(key)} now ${doesWords(id)}.${holder ? ` Nothing ${doesWords(holder.id)} now.` : ""}`);
    void focusBinding(id);
  }

  function cancelAsking() {
    const id = asking?.id;
    asking = undefined;
    say("Not changed.");
    if (id) void focusBinding(id);
  }

  /** Saves the keys at once; if they can't be saved they go back, and the list says so. */
  function save(next: KeyMap, done: string) {
    say(done);
    chooseKeys(next).catch(() => say("Your keys couldn't be saved. Try again in a moment."));
  }

  /** A binding's Reset: its own key again, asked about first if another binding has it now. */
  function reset(id: string) {
    const own = bindingNamed(id)?.key ?? "";
    clearPending();
    offer(id, own);
  }

  function resetAll() {
    if (!changedAny) return;
    clearPending();
    save({}, "Every key is back as it was.");
  }

  /**
   * Escape empties the find field first, wherever the keyboard is in the list, and puts the keyboard
   * back in the field; pressed again, it closes the list. A letter typed while the list is open, outside
   * the field, starts a find: no need to Tab there first.
   */
  function typed(event: KeyboardEvent) {
    if (waiting || asking) return;
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
      if (editing) say("Changing keys. Choose a key to change it; Done when you've finished.");
    }
    if (!open && dialog?.open) dialog.close();
    if (!open) {
      find = "";
      editing = false;
      clearPending();
    }
  });

  /** What a key's button is called, for screen readers: what it does and its key now. */
  function buttonName(binding: Binding): string {
    if (waiting === binding.id) return `Press the new key that ${doesWords(binding.id)}`;
    return `Change the key that ${doesWords(binding.id)}, now ${binding.key ? keyWords(binding.key) : "no key"}`;
  }
</script>

<!--
  Laid out like a reference card: what each shortcut does on the left, its
  keys on the right, in four small groups, three columns side by side on a
  wide screen, the search filters under the last, so at 800px tall
  it fits without scrolling, 48px clear of the window's top and foot. On a
  phone-narrow window it's a screen of its own, as every sheet is there. The title and its close button stay
  put while the list scrolls; a hairline under them shows only once the list
  has scrolled, and one at the foot only while more lies below.
-->
<svelte:window onresize={measure} />

{#snippet caps(key: string)}
  <!--
    "g then u" is two presses: a cap for each key, with "then" between them.
    Caps are printed as a Mac prints them: capital letters, ⇧ for Shift (screen readers
    hear "Shift A"), and a true minus sign on the - key (decisions 0045, 0055).
  -->
  {#each key.split(" then ") as press, step (step)}{@const cap = keyCap(press)}{#if step > 0}<span class="text-[0.75rem] text-muted">{" then "}</span
    >{/if}{#if cap.spoken}<kbd class="key" aria-hidden="true">{cap.cap}</kbd><span class="sr-only">{cap.spoken}</span>{:else}<kbd class="key">{cap.cap}</kbd
    >{/if}{/each}
{/snippet}

<dialog
  bind:this={dialog}
  aria-labelledby="shortcuts-heading"
  onclose={() => (open = false)}
  oncancel={(event) => {
    // Escape while a key is awaited or a question is open answers that, never closes the list.
    if (waiting || asking) event.preventDefault();
  }}
  onkeydowncapture={pressedWhileWaiting}
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
      <h2 id="shortcuts-heading" tabindex="-1" bind:this={heading} class="sheet-title [grid-area:title]">{editing ? "Change keys" : "Keyboard shortcuts"}</h2>
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
    <!-- Each step of changing a key, for screen readers: waiting, refused, asked, changed (decision 0110). -->
    <p role="status" class="sr-only" data-testid="keys-said">{said}</p>
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
        Three columns on a wide screen (two on a medium one), each its own stack, so a short
        group never leaves a hole beside a long one: reading; getting around and anywhere;
        tidying up and the search filters (decisions 0049, 0110). On a narrow screen they
        stack in that order.
      -->
      {#if nothing}
        <p class="py-6 text-center text-small text-muted">No shortcut matches “{find.trim()}”.</p>
      {/if}
      {#if editing}
        <p class="mb-3 text-small text-ink-2">Choose a key to change it, then press the new one. Enter, Escape, ? and the G keys stay as they are.</p>
      {/if}
      <div class="grid gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
        {#each COLUMNS as column, side (side)}
          <div class="flex min-w-0 flex-col gap-5">
            {#each column.filter((each) => shown.some((shortcut) => shortcut.group === each)) as group (group)}
              {@const index = SHORTCUT_GROUPS.indexOf(group)}
              <section aria-labelledby={`keys-${index}`}>
                <h3 id={`keys-${index}`} class="mb-1 text-meta font-semibold text-muted">{group}</h3>
                <table class="w-full text-left text-small">
                  <tbody>
                    {#each shown.filter((each) => each.group === group) as shortcut (shortcut.action)}
                      {@const pending = shortcut.bindings.find((binding) => binding.id === waiting || binding.id === asking?.id || binding.id === problem?.id)}
                      <tr class={["border-ink/[0.07]", pending ? "" : "border-b last:border-0"]}>
                        <td class={["pr-4 align-middle", editing ? "py-0.5" : "py-[3px]"]}>{shortcut.action}</td>
                        <!-- Each shortcut stays whole; on a narrow phone the alternatives wrap at the slashes. -->
                        <td class={["text-right align-middle whitespace-nowrap", editing ? "py-0.5" : "py-[3px]"]}>
                          {#if editing}
                            {#each shortcut.bindings as binding, index (binding.id)}{#if index > 0}<span class="text-muted">{" / "}</span>{/if}{#if binding.fixed}<span
                                  class="inline-flex min-h-11 items-center px-1">{@render caps(binding.key)}</span
                                >{:else}<button
                                  type="button"
                                  data-binding={binding.id}
                                  aria-label={buttonName(binding)}
                                  onclick={() => choose(binding.id)}
                                  class={["key-choice", waiting === binding.id && "key-choice-waiting"]}
                                  >{#if waiting === binding.id}Press the new key…{:else if binding.key}{@render caps(binding.key)}{:else}<span class="text-muted"
                                      >No key</span
                                    >{/if}</button
                                >{#if isChanged(binding.id, keys.chosen)}<button
                                    type="button"
                                    onclick={() => reset(binding.id)}
                                    aria-label={`Reset the key that ${doesWords(binding.id)} to ${keyWords(bindingNamed(binding.id)?.key ?? "")}`}
                                    class="text-link ml-1 px-1 text-meta">Reset</button
                                  >{/if}{/if}{/each}
                          {:else if shortcut.keys.length === 0}
                            <span class="text-muted">No key</span>
                          {:else}
                            {#each shortcut.keys as key, index (key)}{#if index > 0}{" "}{/if}<span class="whitespace-nowrap"
                                >{#if index > 0}<span class="text-muted">{"/ "}</span>{/if}{@render caps(key)}</span
                              >{/each}
                          {/if}
                        </td>
                      </tr>
                      {#if editing && pending}
                        <!-- In place, under the row: why that key can't be used, or whether to take it from another shortcut. -->
                        <tr class="border-b border-ink/[0.07] last:border-0">
                          <td colspan="2" class="pb-2 text-right">
                            {#if asking && asking.id === pending.id}
                              <p class="text-small text-ink-2">{capital(`${keyWords(asking.key)} already ${doesWords(asking.holder.id)}.`)} Use it here instead?</p>
                              <div class="mt-1 flex justify-end gap-3">
                                <button type="button" onclick={cancelAsking} class="btn text-small">Cancel</button>
                                <button type="button" data-use-it onclick={() => asking && give(asking.id, asking.key)} class="btn-primary text-small">Use it</button>
                              </div>
                            {:else if problem && problem.id === pending.id}
                              <p class="text-small text-ink-2">{problem.text}</p>
                            {/if}
                          </td>
                        </tr>
                      {/if}
                    {/each}
                  </tbody>
                </table>
              </section>
            {/each}
            {#if side === COLUMNS.length - 1 && filtersShown.length > 0}
              <section aria-labelledby="filters-heading">
                <h3 id="filters-heading" class="text-meta font-semibold text-muted">Search filters</h3>
                <p class="mt-0.5 mb-1 text-small text-muted">Type these in the search field; each becomes a chip. Names with spaces go in quotes.</p>
                <table class="w-full text-left text-small">
                  <tbody>
                    {#each filtersShown as [filter, meaning] (filter)}
                      <tr class="border-b border-ink/[0.07] last:border-0">
                        <td class="w-px py-[3px] pr-4 whitespace-nowrap sm:pr-8"><code class="font-mono text-meta">{filter}</code></td>
                        <td class="py-[3px]">{meaning}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </section>
            {/if}
          </div>
        {/each}
      </div>
      {#if !editing}
        <!--
          A footer under both columns, the full width, so it never ends one column early or lands mid-list on a phone (decision 0052).
          Change keys… is the quiet way in to choosing keys: words, never a button that shouts (decision 0110).
        -->
        <div class="mt-4 flex flex-wrap items-center justify-between gap-x-4">
          <p class="text-meta text-muted">Tab, Enter and Escape always work too. Shortcuts don't fire while you're typing in a field.</p>
          <button type="button" bind:this={changeButton} onclick={startEditing} class="text-link keyboard-hint">Change keys…</button>
        </div>
      {/if}
    </div>
    {#if editing}
      <!-- While changing keys, the sheet's own row of actions, always in view: Reset all keys at the left, Done at the right. -->
      <div class="sheet-actions shrink-0 justify-between px-6 pt-4">
        <button type="button" onclick={resetAll} aria-disabled={!changedAny} class={["btn", !changedAny && "text-muted"]}>Reset all keys</button>
        <button type="button" onclick={stopEditing} class="btn-primary">Done</button>
      </div>
    {/if}
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
  /* Wide enough for three columns: the card widens to hold them, still 32px clear of the window's sides (decision 0110). */
  @media (width >= 64rem) {
    .shortcuts {
      width: min(72rem, 100vw - 4rem);
    }
  }
  /*
    While changing keys (decision 0110), a key that can change is a button
    around its cap: 44px to press, with no edge of its own (the cap is the
    edge), a faint tone under the pointer as every quiet button has. Waiting
    for a key, it says so in words on the same faint tone, so where the
    next key goes is plain without color.
  */
  .key-choice {
    display: inline-flex;
    min-width: 2.75rem;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding-inline: 0.375rem;
    border-radius: 0.375rem;
    cursor: pointer;
    touch-action: manipulation;
  }
  @media (hover: hover) {
    .key-choice:hover {
      background-color: var(--hover);
    }
  }
  .key-choice-waiting {
    padding-inline: 0.625rem;
    background-color: var(--tone);
    color: var(--ink);
  }
  /* The list's own Tab stop rings just inside its edge, so the card's edge never clips the outline. */
  .shortcut-region:focus-visible {
    outline-offset: -2px;
  }
</style>
