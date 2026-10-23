<!--
  The `?` shortcut list (SPEC section 19). A native dialog: it keeps the
  keyboard inside while open, and Escape closes it. Shortcuts for features
  that don't exist yet say so, rather than pretending to work.
-->
<script lang="ts">
  import { SHORTCUTS } from "./keyboard";

  let { open = $bindable() }: { open: boolean } = $props();

  let dialog: HTMLDialogElement | undefined = $state();

  const FILTERS = [
    ["is:unread", "Unread items only"],
    ["is:starred", "Starred items only"],
    ["feed:name", "One feed"],
    ["folder:name", "One folder"],
    ["after:YYYY-MM-DD", "Published after that day"],
    ["before:YYYY-MM-DD", "Published before that day"],
  ];

  $effect(() => {
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="shortcuts-heading"
  onclose={() => (open = false)}
  class="m-auto max-h-[90dvh] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto rounded bg-paper p-6 text-ink"
>
  <div class="flex items-center justify-between gap-4">
    <h2 id="shortcuts-heading" class="text-xlarge font-semibold">Keyboard shortcuts</h2>
    <button type="button" onclick={() => (open = false)} class="min-h-11 rounded border border-ink px-4">Close</button>
  </div>
  <p class="mt-2 text-small text-muted">
    Tab, Enter and Escape always work too. Shortcuts don't fire while you're typing in a field.
  </p>

  <table class="mt-6 w-full text-left">
    <thead>
      <tr class="text-small text-muted">
        <th scope="col" class="pb-2 font-normal">Keys</th>
        <th scope="col" class="pb-2 font-normal">What it does</th>
      </tr>
    </thead>
    <tbody>
      {#each SHORTCUTS as shortcut (shortcut.action)}
        <tr>
          <td class="py-1 pr-6 align-top whitespace-nowrap">
            {#each shortcut.keys as key, index (key)}{#if index > 0}<span class="text-muted">{" / "}</span>{/if}<kbd
                class="font-mono">{key}</kbd
              >{/each}
          </td>
          <td class="py-1 align-top">
            {shortcut.action}{#if !shortcut.ready}<span class="text-small text-muted">{" · coming later"}</span>{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h3 class="mt-8 text-large font-semibold">Search filters</h3>
  <p class="text-small text-muted">Type these in the search field; each becomes a chip. Names with spaces go in quotes.</p>
  <table class="mt-2 w-full text-left">
    <tbody>
      {#each FILTERS as [filter, meaning] (filter)}
        <tr>
          <td class="py-1 pr-6 align-top whitespace-nowrap"><code class="font-mono">{filter}</code></td>
          <td class="py-1 align-top">{meaning}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</dialog>

<style>
  dialog::backdrop {
    background: rgb(0 0 0 / 0.45);
  }
</style>
