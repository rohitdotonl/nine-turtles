<!--
  OPML import and export (SPEC section 16), in Settings → Your data. Import
  reads the chosen file and says plainly what it did; the feeds' articles
  then arrive in the background over the next few minutes. Export downloads
  every feed and folder as an OPML file.
-->
<script lang="ts">
  import { importMessage, importOpml } from "./feeds";

  let { onImported }: { onImported: () => void } = $props();

  let picker: HTMLInputElement | undefined = $state();
  let busy = $state(false);
  let lines: string[] = $state([]);

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

<div class="flex flex-col items-start gap-2">
  <div class="flex flex-wrap gap-2">
    <!-- The file picker itself is hidden; this button opens it. -->
    <button type="button" aria-disabled={busy} onclick={() => !busy && picker?.click()} class="min-h-11 rounded border border-ink px-4">
      Import OPML
    </button>
    <a href="/api/opml" download class="flex min-h-11 items-center rounded border border-ink px-4">Export OPML</a>
  </div>
  <input
    bind:this={picker}
    type="file"
    accept=".opml,.xml,text/x-opml,text/xml,application/xml"
    onchange={chosen}
    class="sr-only"
    tabindex="-1"
    aria-hidden="true"
  />
  <div role="status" class="flex flex-col gap-1">
    {#each lines as line (line)}
      <p>{line}</p>
    {/each}
  </div>
</div>
