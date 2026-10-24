<!--
  "Edit folder" (SPEC section 15): rename it, or delete it. Deleting a
  folder never deletes its feeds; it happens at once, with Undo on the next
  screen. Cancel or Escape goes back to the folder unchanged. On a wide
  window it's a sheet over the folder's list; on a phone, a screen of its own.
-->
<script lang="ts">
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
    <label class="flex flex-col gap-2">
      <span class="font-semibold">Name</span>
      <input bind:value={name} type="text" autocomplete="off" class="field" />
    </label>
    <!-- One row at the foot: a message at its left, then Cancel and Save at the right end. -->
    <div class="sheet-actions">
      <p role="status" class="mr-auto">{message}</p>
      <button type="button" onclick={onCancel} class="btn">Cancel</button>
      <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
    </div>
  </form>
{/snippet}

{#snippet deleteFolder(page: boolean)}
  <!-- Apart, below a hairline: what it does, then the action in words, in a muted red. -->
  <div class={["sheet-danger", page && "mx-0 mt-6 px-0 pt-6"]}>
    <p class="text-small text-muted">Its feeds stay; they just leave this folder. You can undo it straight afterwards.</p>
    <button type="button" aria-disabled={busy} onclick={remove} class="btn-danger"><span class="truncate">Delete {folder.name}</span></button>
  </div>
{/snippet}

{#if sheet}
  <Sheet title="Edit folder" bind:heading onClose={onCancel}>
    {@render form()}
    {@render deleteFolder(false)}
  </Sheet>
{:else}
<section aria-labelledby="list-heading" class="flex flex-1 flex-col bg-paper pt-3">
  <PageHead title="Edit folder" bind:heading onClose={onCancel} closeLabel="Close without saving" {besideToggle} />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-10 md:px-10">
    <!-- The sheet's build, as a page: the form and its row of actions, then Delete apart. -->
    <div class="mx-auto mt-6 flex max-w-xl flex-col">
      {@render form()}
      {@render deleteFolder(true)}
    </div>
  </div>
</section>
{/if}
