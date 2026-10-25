<!--
  "Save search" and "Edit saved search" (SPEC section 14): name the search
  showing in the list, and it's listed in the sidebar under "Saved
  searches". Editing one renames it and saves what the search field holds
  now, so changing its chips and then saving keeps the change; Delete
  removes only the search, never an article, at once, with Undo on the next
  screen. Built as Edit folder is (decisions 0039, 0052): on a wide window a
  sheet over the list, with Delete in red words at the far left and Cancel
  and Save at the right end; on a phone, the phone sheet, with an X, Delete
  as a group of its own and Save at the screen's foot.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import type { Library } from "./feeds";
  import { changeSaved, describe, refusedSaving, saveSearch, suggestedName, type SavedSearch } from "./saved";
  import type { Query } from "./search";

  let {
    saved,
    query,
    library,
    heading = $bindable(),
    besideToggle = false,
    sheet = false,
    onSaved,
    onCancel,
    onDelete,
  }: {
    /** The saved search being edited; none when saving a new one. */
    saved?: SavedSearch;
    /** What will be saved: the search showing now. */
    query: Query;
    library: Library;
    heading?: HTMLHeadingElement;
    /** The sidebar is hidden, so the top line starts clear of its toggle. */
    besideToggle?: boolean;
    /** Shown as a sheet over the list, not as a page. */
    sheet?: boolean;
    onSaved: (search: SavedSearch) => void;
    onCancel: () => void;
    onDelete?: () => Promise<string | undefined>;
  } = $props();

  const title = (() => (saved ? "Edit saved search" : "Save search"))();
  // The form starts once, from the saved name or a suggestion.
  let name = $state((() => saved?.name ?? suggestedName(query, library))());
  let busy = $state(false);
  let message = $state("");
  let field: HTMLInputElement | undefined = $state();

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    message = "";
    const wanted = $state.snapshot(query);
    if (saved) {
      const refusal = await changeSaved(saved.id, name, wanted);
      busy = false;
      if (refusal) message = refusedSaving(refusal);
      else onSaved({ id: saved.id, name: name.split(/\s+/).filter(Boolean).join(" "), query: wanted });
    } else {
      const answer = await saveSearch(name, wanted);
      busy = false;
      if (typeof answer === "string") message = refusedSaving(answer);
      else onSaved(answer);
    }
  }

  async function remove() {
    if (busy || !onDelete) return;
    busy = true;
    message = "";
    const problem = await onDelete();
    busy = false;
    if (problem) message = problem;
  }
</script>

{#snippet remover(look: string)}
  <button
    type="button"
    aria-disabled={busy}
    aria-label="Delete {saved?.name}"
    aria-describedby="delete-search-help"
    title="Only the saved search goes, never an article. You can undo it straight afterwards."
    onclick={remove}
    class={look}>Delete</button
  >
  <span id="delete-search-help" class="sr-only">Only the saved search goes, never an article. You can undo it straight afterwards.</span>
{/snippet}

{#snippet form()}
  <form onsubmit={save} class={["flex flex-col gap-5", !sheet && "flex-1"]}>
    <label class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">Name</span>
      <input bind:this={field} bind:value={name} type="text" autocomplete="off" class="field" />
    </label>
    <!-- What it searches, in the words the search field's chips use, so it's clear what is kept. -->
    <div class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">Searches for</span>
      <p class="break-words">{describe(query, library)}</p>
    </div>
    <!-- A problem, in red words with an icon, only once there is one: the sheet grows by its line. -->
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>
    {#if sheet}
      <!-- One row at the foot: Delete in red words at the far left, then Cancel and Save at the right end. -->
      <div class="sheet-actions">
        {#if saved}{@render remover("btn-danger")}{/if}
        <button type="button" onclick={onCancel} class="btn">Cancel</button>
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
      </div>
    {:else}
      {#if saved}
        <!-- On a phone: Delete as a group of its own, a red row, then Save at the foot. -->
        <div class="inset-group">
          {@render remover("inset-row inset-action text-danger font-semibold")}
        </div>
      {/if}
      <div class="page-action">
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
      </div>
    {/if}
  </form>
{/snippet}

{#if sheet}
  <!-- A new search starts in its name, ready to type, as Add a feed starts in its field. -->
  <Sheet {title} bind:heading onClose={onCancel} initial={saved ? undefined : () => field}>
    {@render form()}
  </Sheet>
{:else}
<section aria-labelledby="list-heading" class="page-sheet">
  <div class="page-sheet-card">
    <PageHead {title} bind:heading {besideToggle} onClose={onCancel} closeLabel="Close" />
    <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
      <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
        {@render form()}
      </div>
    </div>
  </div>
</section>
{/if}
