<!--
  OPML import and export (SPEC section 16), as two rows of Settings › Your
  data. "Import OPML…" (ending in ›) opens the device's file chooser, reads the chosen file
  and says plainly what it did (in `lines`, which Settings shows under the
  group); the feeds' articles then arrive in the background over the next few
  minutes. "Export OPML" downloads every feed and folder as an OPML file.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { importMessage, importOpml } from "./feeds";

  let { onImported, lines = $bindable([]) }: { onImported: () => void; lines?: string[] } = $props();

  let picker: HTMLInputElement | undefined = $state();
  let busy = $state(false);

  async function chosen() {
    const file = picker?.files?.[0];
    if (!file || busy) return;
    busy = true;
    lines = ["Importing…"];
    const result = await importOpml(file);
    busy = false;
    if (picker) picker.value = "";
    if (typeof result === "string") {
      lines = [result];
      return;
    }
    lines = importMessage(result);
    onImported();
  }
</script>

<input
  bind:this={picker}
  type="file"
  accept=".opml,.xml,text/x-opml,text/xml,application/xml"
  onchange={chosen}
  class="sr-only"
  tabindex="-1"
  aria-hidden="true"
/>
<!--
  The file picker above is hidden; this row opens it. Each row ends in a
  quiet glyph that says it acts (decision 0042): › where something opens, a
  tray where a file is saved.
-->
<button type="button" aria-disabled={busy} onclick={() => !busy && picker?.click()} class="inset-row inset-action"
  >Import OPML…<span class="row-glyph"><Icon name="chevron-right" size={18} /></span></button
>
<a href="/api/opml" download class="inset-row inset-action">Export OPML<span class="row-glyph"><Icon name="download" size={18} /></span></a>
