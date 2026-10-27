<!--
  "Add to collection" (SPEC section 34, decision 0108): from the article's
  More menu, or `l`. A sheet listing the reader's collections as a
  checklist, as Edit feed lists a feed's folders: each a 44px row ending in
  a square tick box, ticked when the article is on it, and "New
  collection…" as the list's last row, a text box of its own. Save puts the
  article on exactly the ticked ones (and a new one, if named); Cancel or
  Escape leaves everything as it was. Taking an article off a collection
  never removes the article.

  It's the same sheet on a phone, over the article: a short choice about
  the article you're reading, like the Aa panel, rather than a screen of
  its own.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import Sheet from "./Sheet.svelte";
  import {
    collectionsOf,
    makeCollection,
    refusedCollection,
    saveCollectionsOf,
    type Collection,
  } from "./collections";

  let {
    article,
    collections,
    heading = $bindable(),
    onMade,
    onClose,
  }: {
    article: { id: number; title: string };
    /** The reader's collections, A to Z. */
    collections: Collection[];
    heading?: HTMLHeadingElement;
    /** A new collection was made here: the sidebar lists it at once. */
    onMade: (collection: Collection) => void;
    /** `saved`: the article's collections changed. */
    onClose: (saved: boolean) => void;
  } = $props();

  /** The ticked collections; unknown until the server says which the article is on. */
  let chosen: number[] | undefined = $state();
  let newName = $state("");
  let busy = $state(false);
  let message = $state("");

  onMount(async () => {
    chosen = await collectionsOf(article.id);
    if (!chosen) message = "This article's collections couldn't be loaded. Try again in a moment.";
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !chosen) return;
    busy = true;
    message = "";
    let ticked = [...chosen];
    if (newName.trim() !== "") {
      const made = await makeCollection(newName);
      if (typeof made === "string") {
        busy = false;
        message = refusedCollection(made);
        return;
      }
      onMade(made);
      newName = "";
      ticked = [...ticked, made.id];
      chosen = ticked;
    }
    const refusal = await saveCollectionsOf(article.id, ticked);
    busy = false;
    if (refusal) message = refusedCollection(refusal);
    else onClose(true);
  }
</script>

<Sheet title="Add to collection" bind:heading onClose={() => onClose(false)}>
  <form onsubmit={save} class="flex flex-col gap-5">
    <fieldset class="flex min-w-0 flex-col gap-1.5">
      <legend class="mb-1.5 min-w-0 text-small break-words text-ink-2">Collections for “{article.title}”</legend>
      <!--
        A checklist, as Edit feed's folders (decision 0045): square tick boxes, because an
        article can be on several collections. "New collection…" is the list's last row.
      -->
      <div class="inset-group">
        {#each collections as collection (collection.id)}
          <label class="inset-row check-row">
            <input
              type="checkbox"
              checked={chosen?.includes(collection.id) ?? false}
              disabled={chosen === undefined}
              onchange={(event) => {
                const on = event.currentTarget.checked;
                chosen = on ? [...(chosen ?? []), collection.id] : (chosen ?? []).filter((id) => id !== collection.id);
              }}
            />
            <span class="min-w-0 break-words">{collection.name}</span>
            <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
          </label>
        {/each}
        <label class="inset-row">
          <span class="sr-only">New collection</span>
          <input
            bind:value={newName}
            type="text"
            autocomplete="off"
            placeholder="New collection…"
            class="inset-input"
            aria-describedby="new-collection-hint"
          />
        </label>
      </div>
      <span id="new-collection-hint" class="field-help mt-0"
        >{collections.length === 0 ? "No collections yet. " : ""}Optional: a new collection is made when you save, with this article on it.</span
      >
    </fieldset>
    <!-- A problem, in red words with an icon, only once there is one: the sheet grows by its line. -->
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>
    <div class="sheet-actions">
      <button type="button" onclick={() => onClose(false)} class="btn">Cancel</button>
      <button type="submit" aria-disabled={busy || chosen === undefined} class="btn-primary">Save</button>
    </div>
  </form>
</Sheet>
