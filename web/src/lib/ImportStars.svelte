<!--
  Bringing stars over from another feed reader (SPEC section 23), as a row of
  Settings › Your data. "Import starred articles…" (ending in ›) opens the
  device's file chooser, reads the chosen file (the JSON file Inoreader,
  Feedly, Feedbin, another nine turtles and others export starred articles
  in) and says plainly what it did, in `lines`, which Settings shows under
  the group.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { importStars, starsMessage } from "./feeds";

  let { onImported, lines = $bindable([]) }: { onImported: () => void; lines?: string[] } = $props();

  let picker: HTMLInputElement | undefined = $state();
  let busy = $state(false);

  async function chosen() {
    const file = picker?.files?.[0];
    if (!file || busy) return;
    busy = true;
    lines = ["Importing…"];
    const result = await importStars(file);
    busy = false;
    if (picker) picker.value = "";
    if (typeof result === "string") {
      lines = [result];
      return;
    }
    lines = starsMessage(result);
    onImported();
  }
</script>

<input
  bind:this={picker}
  type="file"
  accept=".json,application/json,application/feed+json"
  onchange={chosen}
  class="sr-only"
  tabindex="-1"
  aria-hidden="true"
/>
<button type="button" aria-disabled={busy} onclick={() => !busy && picker?.click()} class="inset-row inset-action"
  >Import starred articles…<span class="row-glyph"><Icon name="chevron-right" size={18} /></span></button
>
