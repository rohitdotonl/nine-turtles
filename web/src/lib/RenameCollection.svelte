<!--
  "Rename…" from a collection's More menu (SPEC section 34, decision 0108):
  a sheet with its name, then Cancel and Save, built as Edit folder's sheet
  is. Delete is the menu's own item, with Undo afterwards, so it isn't here.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";
  import { refusedCollection, renameCollection, type Collection } from "./collections";

  let {
    collection,
    heading = $bindable(),
    onSaved,
    onCancel,
  }: {
    collection: Collection;
    heading?: HTMLHeadingElement;
    onSaved: (name: string) => void;
    onCancel: () => void;
  } = $props();

  // The form starts from the collection's name as it is now, once.
  let name = $state((() => collection.name)());
  let busy = $state(false);
  let message = $state("");

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    message = "";
    const refusal = await renameCollection(collection.id, name);
    busy = false;
    if (refusal) message = refusedCollection(refusal);
    else onSaved(name.split(/\s+/).filter(Boolean).join(" "));
  }
</script>

<Sheet title="Rename collection" bind:heading onClose={onCancel}>
  <form onsubmit={save} class="flex flex-col gap-5">
    <label class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">Name</span>
      <input bind:value={name} type="text" autocomplete="off" class="field" />
    </label>
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>
    <div class="sheet-actions">
      <button type="button" onclick={onCancel} class="btn">Cancel</button>
      <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
    </div>
  </form>
</Sheet>
