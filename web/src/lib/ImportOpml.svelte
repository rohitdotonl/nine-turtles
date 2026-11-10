<!--
  OPML import and export (SPEC section 16), as two rows of Settings › Your
  data. "Import OPML…" (ending in ›) opens the device's file chooser, reads the chosen file
  and says plainly what it did (in `lines`, which Settings shows under the
  group); the feeds' articles then arrive in the background over the next few
  minutes. "Export OPML" downloads every feed and folder as an OPML file.
  "Import YouTube subscriptions…" takes the subscriptions.csv Google Takeout
  gives, each channel as its feed, the same way (decision 0144).
  In the welcome (`link`), only the way in, as a text link that opens the file chooser at once.
  In Settings, an import that added something hands over its Undo (`undo`):
  "Wrong file? Undo the import" takes away exactly what it added (decision 0238).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { importMessage, importOpml, undoImport } from "./importing";

  let {
    onImported,
    lines = $bindable([]),
    undo = $bindable(),
    link,
  }: {
    /** A list was read; `lines` say what came of it, and `added` how many feeds came in. */
    onImported: (lines: string[], added: number) => void;
    lines?: string[];
    /** After an import that added something: takes it away again. "too-late" once it can't. */
    undo?: () => Promise<"too-late" | undefined>;
    /** In the welcome: only the way in, as a text link with these words (no Settings rows, no Export). */
    link?: string;
  } = $props();

  let picker: HTMLInputElement | undefined = $state();
  let youtubePicker: HTMLInputElement | undefined = $state();
  let busy = $state(false);

  async function chosen(from: HTMLInputElement | undefined, youtube = false) {
    const file = from?.files?.[0];
    if (!file || busy) return;
    busy = true;
    undo = undefined;
    lines = ["Importing…"];
    const result = await importOpml(file, youtube);
    busy = false;
    if (from) from.value = "";
    if (typeof result === "string") {
      lines = [result];
      return;
    }
    lines = importMessage(result);
    if (result.undoable && !link) undo = undoImport;
    onImported(lines, result.added);
  }
</script>

<input
  bind:this={picker}
  type="file"
  accept=".opml,.xml,text/x-opml,text/xml,application/xml"
  onchange={() => chosen(picker)}
  class="sr-only"
  tabindex="-1"
  aria-hidden="true"
/>
{#if !link}
  <input
    bind:this={youtubePicker}
    type="file"
    accept=".csv,text/csv"
    onchange={() => chosen(youtubePicker, true)}
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
  />
{/if}
<!--
  The file picker above is hidden; this row opens it. Each row ends in a
  quiet glyph that says it acts (decision 0042): › where something opens, a
  tray where a file is saved.
-->
{#if link}
  <button type="button" aria-disabled={busy} onclick={() => !busy && picker?.click()} class="text-link">{link}</button>
{:else}
  <button type="button" aria-disabled={busy} onclick={() => !busy && picker?.click()} class="inset-row inset-action"
    >Import OPML…<span class="row-glyph"><Icon name="chevron-right" size={18} /></span></button
  >
  <a href="/api/opml" download class="inset-row inset-action">Export OPML<span class="row-glyph"><Icon name="download" size={18} /></span></a>
  <button type="button" aria-disabled={busy} onclick={() => !busy && youtubePicker?.click()} class="inset-row inset-action"
    >Import YouTube subscriptions…<span class="row-glyph"><Icon name="chevron-right" size={18} /></span></button
  >
{/if}
