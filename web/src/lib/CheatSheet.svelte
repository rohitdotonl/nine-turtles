<!--
  The `?` shortcut list (SPEC section 19). A native dialog: it keeps the
  keyboard inside while open, and Escape closes it. Shortcuts for features
  that don't exist yet aren't listed.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { SHORTCUT_GROUPS, SHORTCUTS } from "./keyboard";

  let { open = $bindable() }: { open: boolean } = $props();

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

  const FILTERS = [
    ["is:unread", "Unread items only"],
    ["is:starred", "Starred items only"],
    ["feed:name", "One feed"],
    ["folder:name", "One folder"],
    ["after:YYYY-MM-DD", "Published after that day"],
    ["before:YYYY-MM-DD", "Published before that day"],
  ];

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
  keys on the right, in four small groups, two columns side by side on a
  wide screen, the search filters in two columns of three under them, so on
  most windows it fits without scrolling. The title and its close button stay
  put while the list scrolls; a hairline under them shows only once the list
  has scrolled, and one at the foot only while more lies below.
-->
<svelte:window onresize={measure} />

<dialog
  bind:this={dialog}
  aria-labelledby="shortcuts-heading"
  onclose={() => (open = false)}
  class="floating dimmed m-auto max-h-[calc(100dvh-2rem)] w-[min(52rem,calc(100vw-2rem))] overflow-hidden p-0 text-ink"
>
  <!-- A 16px band of paper under the list, so a row cut by its foot sits above a hairline, never against the card's edge. -->
  <div class="flex max-h-[calc(100dvh-2rem)] flex-col pb-4">
    <div class={["flex min-h-16 shrink-0 items-center justify-between gap-4 border-b pr-4 pl-6", scrolled ? "border-ink/10" : "border-transparent"]}>
      <h2 id="shortcuts-heading" tabindex="-1" bind:this={heading} class="sheet-title">Keyboard shortcuts</h2>
      <button type="button" onclick={() => (open = false)} aria-label="Close" title="Close (Esc)" class="btn-quiet btn-icon"><Icon name="close" size={18} /></button>
    </div>
    <!-- A Tab stop of its own, so the list can be scrolled with the keyboard (axe: scrollable-region-focusable). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      tabindex="0"
      role="region"
      aria-label="Shortcuts"
      bind:this={list}
      onscroll={measure}
      class={["min-h-0 overflow-y-auto border-b px-6 pt-2 pb-4 shortcut-region", more ? "border-ink/10" : "border-transparent"]}
    >
      <div class="grid gap-x-10 gap-y-7 md:grid-cols-2">
        {#each SHORTCUT_GROUPS as group, index (group)}
          <section aria-labelledby={`keys-${index}`}>
            <h3 id={`keys-${index}`} class="mb-1.5 text-meta font-semibold text-muted">{group}</h3>
            <table class="w-full text-left text-small">
              <tbody>
                {#each SHORTCUTS.filter((each) => each.group === group && each.ready) as shortcut (shortcut.action)}
                  <tr class="border-b border-ink/[0.07] last:border-0">
                    <td class="py-2 pr-4 align-middle">{shortcut.action}</td>
                    <!--
                      "g then u" is two presses: a cap for each key, with "then" between them.
                      Each shortcut stays whole; on a narrow phone the alternatives wrap at the slashes.
                    -->
                    <td class="py-2 text-right align-middle whitespace-nowrap">
                      {#each shortcut.keys as key, index (key)}{#if index > 0}{" "}{/if}<span class="whitespace-nowrap"
                          >{#if index > 0}<span class="text-muted">{"/ "}</span>{/if}{#each key.split(" then ") as press, step (step)}{#if step > 0}<span
                                class="text-meta text-muted">{" then "}</span
                              >{/if}<kbd class="key">{press}</kbd>{/each}</span
                        >{/each}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </section>
        {/each}
      </div>

      <section aria-labelledby="filters-heading" class="mt-8">
        <h3 id="filters-heading" class="text-meta font-semibold text-muted">Search filters</h3>
        <p class="mt-0.5 mb-1.5 text-small text-muted">Type these in the search field; each becomes a chip. Names with spaces go in quotes.</p>
        <div class="grid gap-x-10 md:grid-cols-2">
          {#each [FILTERS.slice(0, 3), FILTERS.slice(3)] as half, column (column)}
            <table class="w-full text-left text-small">
              <tbody>
                {#each half as [filter, meaning] (filter)}
                  <tr class="border-b border-ink/[0.07] last:border-0">
                    <td class="w-px py-2 pr-4 whitespace-nowrap sm:pr-8"><code class="font-mono text-meta">{filter}</code></td>
                    <td class="py-2">{meaning}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/each}
        </div>
      </section>
      <p class="mt-6 text-meta text-muted">Tab, Enter and Escape always work too. Shortcuts don't fire while you're typing in a field.</p>
    </div>
  </div>
</dialog>

<style>
  /* The list's own Tab stop rings just inside its edge, so the card's edge never clips the outline. */
  .shortcut-region:focus-visible {
    outline-offset: -2px;
  }
</style>
