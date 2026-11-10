<!--
  The `?` shortcut list (SPEC section 19). A native dialog: it keeps the
  keyboard inside while open, and Escape closes it. Only what a reader needs
  to take in at a glance, like a printed card (decision 0180).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { helpPage } from "./router";
  import { GO_TO, SHORTCUT_GROUPS, keyCap, shortcutsFor } from "./keyboard";

  let {
    open = $bindable(),
    unreadOff = false,
  }: {
    open: boolean;
    /** Unread off: Go to Unread and Mark all as read aren't listed. */
    unreadOff?: boolean;
  } = $props();

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

  /** The groups in each of the two columns, in the order they matter. */
  const COLUMNS: (typeof SHORTCUT_GROUPS)[number][][] = [
    ["Reading", GO_TO],
    ["Getting around", "Tidying up"],
  ];

  const shown = $derived(shortcutsFor(unreadOff));

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
  });
</script>

<!--
  Laid out like a reference card: what each shortcut does on the left, its
  keys on the right, in small groups, two columns side by side, parted by
  space alone, so at 800px tall it fits without scrolling. On a phone-narrow
  window it's a screen of its own, as every sheet is there. The title and its
  close button stay put while the list scrolls; a hairline under them shows
  only once the list has scrolled, and one at the foot only while more lies below.
-->
<svelte:window onresize={measure} />

{#snippet caps(key: string)}
  <!--
    "Shift+A" is two caps, as it's two keys. In the Go to group the heading already says
    "G, then…", so only the second press is printed; screen readers still hear both.
  -->
  {#each key.split(" then ") as press, step (step)}{#if step === 0 && key.includes(" then ")}<span class="sr-only">{keyCap(press)} then </span>{:else}{#each keyCap(press).split(" ") as cap, index (index)}{#if index > 0}{" "}{/if}<kbd class="key">{cap}</kbd>{/each}{/if}{/each}
{/snippet}

<dialog
  bind:this={dialog}
  aria-labelledby="shortcuts-heading"
  onclose={() => (open = false)}
  class="shortcuts floating dimmed m-auto w-[min(52rem,calc(100vw-2rem))] overflow-hidden p-0 text-ink"
>
  <!-- A 16px band of paper under the list, so a row cut by its foot sits above a hairline, never against the card's edge. -->
  <div class="shortcuts-body flex flex-col pb-4">
    <div class={["shortcuts-head flex shrink-0 items-center justify-between gap-x-4 border-b pr-4 pl-6", scrolled ? "border-[var(--line)]" : "border-transparent"]}>
      <h2 id="shortcuts-heading" tabindex="-1" bind:this={heading} class="sheet-title">Keyboard shortcuts</h2>
      <button type="button" onclick={() => (open = false)} aria-label="Close" title="Close (Esc)" class="btn-quiet btn-icon"><Icon name="close" size="alone" /></button>
    </div>
    <!-- A Tab stop of its own, so the list can be scrolled with the keyboard (axe: scrollable-region-focusable). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      tabindex="0"
      role="region"
      aria-label="Shortcuts"
      bind:this={list}
      onscroll={measure}
      class={["shortcuts-list min-h-0 overflow-y-auto border-b px-6 pt-1 pb-2 shortcut-region", more ? "border-[var(--line)]" : "border-transparent"]}
    >
      <!-- Two columns, each its own stack, so a short group never leaves a hole beside a long one; on a narrow screen they stack in that order. -->
      <div class="grid gap-x-12 gap-y-6 md:grid-cols-2">
        {#each COLUMNS as column, side (side)}
          <div class="flex min-w-0 flex-col gap-6">
            {#each column.filter((each) => shown.some((shortcut) => shortcut.group === each)) as group (group)}
              {@const index = SHORTCUT_GROUPS.indexOf(group)}
              <section aria-labelledby={`keys-${index}`}>
                <h3 id={`keys-${index}`} class="mb-2 text-base font-semibold text-ink">{group}</h3>
                <table class="w-full text-left text-meta">
                  <tbody>
                    {#each shown.filter((each) => each.group === group) as shortcut (shortcut.action)}
                      <tr class="h-7">
                        <td class="pr-4 align-middle">{shortcut.action}</td>
                        <!-- Each shortcut stays whole; on a narrow phone the alternatives wrap at the slashes. -->
                        <td class="text-right align-middle whitespace-nowrap">
                          {#each shortcut.keys as key, index (key)}{#if index > 0}{" "}{/if}<span class="whitespace-nowrap"
                              >{#if index > 0}<span class="text-muted">{shortcut.either ? "or " : "/ "}</span>{/if}{@render caps(key)}</span
                            >{/each}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </section>
            {/each}
          </div>
        {/each}
      </div>
      <p class="mt-4 text-right"><a href={helpPage("every-keyboard-key")} target="_blank" rel="noopener" class="text-link">Help<span class="sr-only"> with keys (on the nine turtles website, opens in a new tab)</span></a></p>
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
    a time, layout.svelte.ts) it's a screen of its own, as Add a feed and Edit feed
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
      min-height: var(--bar-h);
      padding-inline: 1.25rem 0.75rem;
    }
    .shortcuts-list {
      flex: 1 1 auto;
      padding-inline: 1.25rem;
    }
  }
  @media (width >= 56rem) {
    .shortcuts-head {
      min-height: 4rem;
    }
  }
  /* The list's own Tab stop rings just inside its edge, so the card's edge never clips the outline. */
  .shortcut-region:focus-visible {
    outline-offset: -2px;
  }
</style>
