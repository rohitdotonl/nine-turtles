<!--
  "Edit folder" (SPEC section 15): rename it, or delete it. Deleting a
  folder never deletes its feeds; it happens at once, with Undo on the next
  screen. Cancel or Escape goes back to the folder unchanged.
-->
<script lang="ts">
  import PageHead from "./PageHead.svelte";
  import { edge } from "./edge";
  import { refused, renameFolder, type Folder } from "./feeds";

  let {
    folder,
    heading = $bindable(),
    besideToggle = false,
    onSaved,
    onCancel,
    onDelete,
  }: {
    folder: Folder;
    heading?: HTMLHeadingElement;
    /** The sidebar is hidden, so the top line starts clear of its toggle. */
    besideToggle?: boolean;
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

<section aria-labelledby="list-heading" class="flex flex-1 flex-col bg-paper pt-3">
  <PageHead title="Edit folder" bind:heading onClose={onCancel} closeLabel="Close without saving" {besideToggle} />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-10 md:px-10">
    <form onsubmit={save} class="mt-6 flex max-w-xl flex-col gap-6">
      <label class="flex flex-col gap-2">
        <span class="font-semibold">Name</span>
        <input bind:value={name} type="text" autocomplete="off" class="field" />
      </label>
      <div class="flex flex-wrap gap-2">
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
        <button type="button" onclick={onCancel} class="btn">Cancel</button>
      </div>
      <p role="status">{message}</p>
    </form>

    <section aria-labelledby="delete-heading" class="mt-10 flex max-w-xl flex-col items-start gap-2">
      <h3 id="delete-heading" class="text-large font-semibold">Delete folder</h3>
      <p>Its feeds stay; they just leave this folder. You can undo it straight afterwards.</p>
      <button type="button" aria-disabled={busy} onclick={remove} class="btn">
        Delete {folder.name}
      </button>
    </section>
  </div>
</section>
