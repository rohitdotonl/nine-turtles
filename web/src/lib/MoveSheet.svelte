<!--
  "Move to a folder" (SPEC sections 5 and 15): a choice of one, as a grouped
  list with a round mark at each row's end: No folder, each folder, and New
  folder with a box for its name. None is chosen at first, so Move never
  takes anyone out of their folders by default (decision 0137). Everyone you
  follow opens it for those chosen; a person's handle in the sidebar's Edit
  for one person. Cancel or Escape closes only the sheet.
-->
<script lang="ts">
  import Waiting from "./Waiting.svelte";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";
  import type { Folder } from "./shapes";

  let {
    folders,
    help,
    onMove,
    onClose,
  }: {
    folders: Folder[];
    /** The line under the list: what moving does to the folders they were in. */
    help: string;
    /** Moves them: to a folder, to no folder (null), or to a new folder named `naming`. Answers a problem to say, if any. */
    onMove: (folder: Folder | null, naming: string) => Promise<string | undefined>;
    onClose: () => void;
  } = $props();

  /** "none" (no folder), a folder's number, "new", or "" until one is chosen. */
  let destination = $state("");
  let newFolder = $state("");
  let problem = $state("");
  let busy = $state(false);
  let heading: HTMLHeadingElement | undefined = $state();

  async function move(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    if (!destination) {
      problem = "Choose where they go first.";
      return;
    }
    const naming = destination === "new" ? newFolder.trim() : "";
    if (destination === "new" && !naming) {
      problem = "Give the new folder a name.";
      return;
    }
    const folder = folders.find((each) => String(each.id) === destination) ?? null;
    busy = true;
    problem = (await onMove(folder, naming)) ?? "";
    busy = false;
  }

  /** Escape inside the sheet closes only the sheet. */
  function keepEscape(event: KeyboardEvent) {
    event.stopPropagation();
  }
</script>

<div role="presentation" onkeydown={keepEscape}>
  <Sheet title="Move to a folder" bind:heading {onClose}>
    <form onsubmit={move} class="flex flex-col gap-5">
      <fieldset class="flex min-w-0 flex-col gap-2">
        <legend class="mb-2 text-meta text-ink-2">To</legend>
        <!-- A choice of one: a round mark at each row's end, as a Mac draws a radio button. -->
        <div class="inset-group">
          <label class="inset-row check-row">
            <input type="radio" name="destination" value="none" bind:group={destination} />
            <span class="min-w-0 break-words">No folder</span>
            <span aria-hidden="true" class="radio-mark shrink-0"></span>
          </label>
          <!-- New folder… under No folder, before the folders, as in + Add (decision 0261): found without scrolling past them. -->
          <label class="inset-row check-row">
            <input type="radio" name="destination" value="new" bind:group={destination} />
            <span class="min-w-0 break-words">New folder…</span>
            <span aria-hidden="true" class="radio-mark shrink-0"></span>
          </label>
          {#if destination === "new"}
            <label class="inset-row">
              <span class="sr-only">New folder's name</span>
              <!-- svelte-ignore a11y_autofocus -->
              <input dir="auto" bind:value={newFolder} type="text" autocomplete="off" placeholder="Name" class="inset-input" autofocus />
            </label>
          {/if}
          {#each folders as folder (folder.id)}
            <label class="inset-row check-row">
              <input type="radio" name="destination" value={String(folder.id)} bind:group={destination} />
              <span class="min-w-0 break-words">{folder.name}</span>
              <span aria-hidden="true" class="radio-mark shrink-0"></span>
            </label>
          {/each}
        </div>
        <span class="field-help mt-0">{help}</span>
      </fieldset>
      <!-- A problem, in red words with an icon, only once there is one: the sheet grows by its line. -->
      <p role="status" class={["flex items-start gap-2 text-meta text-danger", !problem && "sr-only"]}>
        {#if problem}<span class="mt-px shrink-0"><Icon name="alert" /></span>{problem}{/if}
      </p>
      <div class="sheet-actions">
        <button type="button" onclick={onClose} class="btn">Cancel</button>
        <button type="submit" aria-disabled={busy} class="btn-primary"><Waiting {busy} word="Move" doing="Moving…" /></button>
      </div>
    </form>
  </Sheet>
</div>
