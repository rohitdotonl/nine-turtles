<!--
  "Edit folder" (SPEC section 15): rename it, or delete it. Deleting a
  folder never deletes its feeds; it happens at once, with Undo on the next
  screen. Cancel or Escape goes back to the folder unchanged. On a wide
  window it's a sheet over the folder's list; on a phone, a screen of its own.
  Delete sits at the far left of the one row of actions, in red words, with
  Cancel and Save at the right end (decision 0039).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import { refused, renameFolder, type Folder } from "./feeds";

  let {
    folder,
    heading = $bindable(),
    besideToggle = false,
    sheet = false,
    onSaved,
    onCancel,
    onDelete,
  }: {
    folder: Folder;
    heading?: HTMLHeadingElement;
    /** The sidebar is hidden, so the top line starts clear of its toggle. */
    besideToggle?: boolean;
    /** Shown as a sheet over the list, not as a page. */
    sheet?: boolean;
    onSaved: () => void;
    onCancel: () => void;
    onDelete: () => Promise<string | undefined>;
  } = $props();

  // The form starts from the folder's name as it is now, once.
  let name = $state((() => folder.name)());
  let busy = $state(false);
  let message = $state("");

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    message = "";
    const refusal = await renameFolder(folder.id, name);
    busy = false;
    if (refusal) message = refused(refusal, "folder");
    else onSaved();
  }

  async function remove() {
    if (busy) return;
    busy = true;
    message = "";
    const problem = await onDelete();
    busy = false;
    if (problem) message = problem;
  }
</script>

{#snippet form()}
  <form onsubmit={save} class="flex flex-col gap-5">
    <label class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">Name</span>
      <input bind:value={name} type="text" autocomplete="off" class="field" />
    </label>
    <!-- A problem, in red words with an icon, only once there is one: the sheet grows by its line. -->
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>
    <!-- One row at the foot: Delete in red words at the far left, then Cancel and Save at the right end. -->
    <div class="sheet-actions">
      <button
        type="button"
        aria-disabled={busy}
        aria-label="Delete {folder.name}"
        aria-describedby="delete-folder-help"
        title="Its feeds stay; they just leave this folder. You can undo it straight afterwards."
        onclick={remove}
        class="btn-danger">Delete</button
      >
      <span id="delete-folder-help" class="sr-only">Its feeds stay; they just leave this folder. You can undo it straight afterwards.</span>
      <button type="button" onclick={onCancel} class="btn">Cancel</button>
      <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
    </div>
  </form>
{/snippet}

{#if sheet}
  <Sheet title="Edit folder" bind:heading onClose={onCancel}>
    {@render form()}
  </Sheet>
{:else}
<section aria-labelledby="list-heading" class="flex flex-1 flex-col bg-paper">
  <PageHead title="Edit folder" bind:heading onClose={onCancel} closeLabel="Close without saving" {besideToggle} />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-10 md:px-10">
    <!-- The sheet's build, as a page. -->
    <div class="mx-auto mt-6 flex max-w-xl flex-col">
      {@render form()}
    </div>
  </div>
</section>
{/if}
