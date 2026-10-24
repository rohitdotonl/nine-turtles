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
  /** More of the list lies below what's shown: its foot fades, so it never looks cut off mid-row. */
  let more = $state(false);

  function measure() {
    if (list) more = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
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
      // The keyboard starts on the title, so the X isn't ringed the moment the list opens.
      heading?.focus();
      measure();
    }
    if (!open && dialog?.open) dialog.close();
  });
</script>

<!--
  Laid out like a reference card: what each shortcut does on the left, its
  keys on the right, in four small groups, two columns side by side on a
  wide screen. The title and its close button stay put while the list scrolls.
-->
<svelte:window onresize={measure} />

<dialog
  bind:this={dialog}
  aria-labelledby="shortcuts-heading"
  onclose={() => (open = false)}
  class="floating dimmed m-auto max-h-[min(44rem,90dvh)] w-[min(52rem,calc(100vw-2rem))] overflow-hidden p-0 text-ink"
>
  <div class="flex max-h-[min(44rem,90dvh)] flex-col">
    <div class="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-ink/10 pr-4 pl-6">
      <h2 id="shortcuts-heading" tabindex="-1" bind:this={heading} class="text-ui font-semibold">Keyboard shortcuts</h2>
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
      data-more={more ? "" : undefined}
      class="shortcut-list min-h-0 overflow-y-auto px-6 pt-5 pb-6"
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
        <table class="w-full text-left text-small">
          <tbody>
            {#each FILTERS as [filter, meaning] (filter)}
              <tr class="border-b border-ink/[0.07] last:border-0">
                <td class="w-px py-2 pr-4 whitespace-nowrap sm:pr-8"><code class="font-mono text-meta">{filter}</code></td>
                <td class="py-2">{meaning}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
      <p class="mt-6 text-meta text-muted">Tab, Enter and Escape always work too. Shortcuts don't fire while you're typing in a field.</p>
    </div>
  </div>
</dialog>

<style>
  /* While more lies below, the last 32px fade out, so the list never looks clipped mid-row; at the end it stops on its last line, unfaded. */
  .shortcut-list[data-more] {
    mask-image: linear-gradient(to bottom, #000 calc(100% - 2rem), transparent);
  }
</style>
