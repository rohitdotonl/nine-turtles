<!--
  "Edit feed" (SPEC section 15): the feed's name, its folders as a
  checklist, a new folder, and Unsubscribe. Saving changes the name and
  folders together; Cancel or Escape goes back to the feed unchanged.
  Unsubscribing happens at once, with Undo on the next screen. On a wide
  window it's a sheet over the feed's list; on a phone, a screen of its own.

  One row of actions at the foot, in a Mac sheet's order: Unsubscribe in red
  words at the far left, apart from the rest, then Cancel and Save at the
  right end (decision 0039).
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import { edge } from "./edge";
  import { editFeed, refused, type Feed, type Folder } from "./feeds";

  let {
    feed,
    folders,
    heading = $bindable(),
    besideToggle = false,
    sheet = false,
    onSaved,
    onCancel,
    onUnsubscribe,
  }: {
    feed: Feed;
    folders: Folder[];
    heading?: HTMLHeadingElement;
    /** The sidebar is hidden, so the top line starts clear of its toggle. */
    besideToggle?: boolean;
    /** Shown as a sheet over the list, not as a page. */
    sheet?: boolean;
    onSaved: () => void;
    onCancel: () => void;
    onUnsubscribe: () => Promise<string | undefined>;
  } = $props();

  // The form starts from the feed as it is now, once.
  let title = $state((() => feed.title)());
  let chosen: number[] = $state((() => [...feed.folders])());
  let newFolder = $state("");
  let busy = $state(false);
  let message = $state("");

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    message = "";
    const refusal = await editFeed(feed.id, title, chosen, newFolder);
    busy = false;
    if (refusal) message = refused(refusal, "feed");
    else onSaved();
  }

  async function leave() {
    if (busy) return;
    busy = true;
    message = "";
    const problem = await onUnsubscribe();
    busy = false;
    if (problem) message = problem;
  }
</script>

{#snippet form()}
  <form onsubmit={save} class="flex flex-col gap-5">
    <label class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">Name</span>
      <input bind:value={title} type="text" autocomplete="off" class="field" />
    </label>

    <fieldset class="flex min-w-0 flex-col gap-1.5">
      <legend class="mb-1.5 text-small text-ink-2">Folders</legend>
      {#if folders.length > 0}
        <!-- A checklist, as a Mac lists choices: each folder a row, a checkmark at its end when the feed is in it. -->
        <div class="inset-group">
          {#each folders as folder (folder.id)}
            <label class="inset-row check-row pointer-fine:min-h-9">
              <input type="checkbox" value={folder.id} bind:group={chosen} />
              <span class="min-w-0 break-words">{folder.name}</span>
              <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={18} /></span>
            </label>
          {/each}
        </div>
      {/if}
      <label class="mt-2 flex flex-col gap-1.5">
        <span class="text-small text-ink-2">New folder</span>
        <input bind:value={newFolder} type="text" autocomplete="off" class="field" aria-describedby="new-folder-hint" />
        <span id="new-folder-hint" class="text-meta text-muted"
          >{folders.length === 0 ? "No folders yet. " : ""}Optional. The feed goes in it when you save.</span
        >
      </label>
    </fieldset>

    <!-- A problem, in red words with an icon, only once there is one: the sheet grows by its line. -->
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>

    <!-- One row at the foot: Unsubscribe at the far left, then Cancel and Save at the right end. -->
    <div class="sheet-actions">
      <button
        type="button"
        aria-disabled={busy}
        aria-describedby="unsubscribe-help"
        title="Stops following this feed and removes its articles; starred ones stay. You can undo it straight afterwards."
        aria-label="Unsubscribe from {feed.title}"
        onclick={leave}
        class="btn-danger">Unsubscribe</button
      >
      <span id="unsubscribe-help" class="sr-only">Removes its articles; starred ones stay. You can undo it straight afterwards.</span>
      <button type="button" onclick={onCancel} class="btn">Cancel</button>
      <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
    </div>
  </form>
{/snippet}

{#if sheet}
  <Sheet title="Edit feed" bind:heading onClose={onCancel}>
    {@render form()}
  </Sheet>
{:else}
<section aria-labelledby="list-heading" class="flex flex-1 flex-col bg-paper pt-3">
  <PageHead title="Edit feed" bind:heading onClose={onCancel} closeLabel="Close without saving" {besideToggle} />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-10 md:px-10">
    <!-- The sheet's build, as a page. -->
    <div class="mx-auto mt-6 flex max-w-xl flex-col">
      {@render form()}
    </div>
  </div>
</section>
{/if}
