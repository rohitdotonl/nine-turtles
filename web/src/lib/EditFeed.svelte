<!--
  "Edit feed" (SPEC section 15): the feed's name, its folders as
  checkboxes, a new folder, and Unsubscribe. Saving changes the name and
  folders together; Cancel or Escape goes back to the feed unchanged.
  Unsubscribing happens at once, with Undo on the next screen.
-->
<script lang="ts">
  import { editFeed, refused, type Feed, type Folder } from "./feeds";

  let {
    feed,
    folders,
    heading = $bindable(),
    onSaved,
    onCancel,
    onUnsubscribe,
  }: {
    feed: Feed;
    folders: Folder[];
    heading?: HTMLHeadingElement;
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

<section aria-labelledby="list-heading" class="flex flex-1 flex-col bg-paper pt-16">
  <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-10 md:px-10">
    <h2 id="list-heading" tabindex="-1" bind:this={heading} class="text-xlarge font-semibold">Edit feed</h2>
    <form onsubmit={save} class="mt-6 flex max-w-xl flex-col gap-6">
      <label class="flex flex-col gap-2">
        <span class="font-semibold">Name</span>
        <input bind:value={title} type="text" autocomplete="off" class="min-h-11 rounded border border-ink bg-paper px-3" />
      </label>

      <fieldset>
        <legend class="font-semibold">Folders</legend>
        {#if folders.length === 0}
          <p class="text-small text-muted">No folders yet. Name one below to make it.</p>
        {/if}
        {#each folders as folder (folder.id)}
          <label class="flex min-h-11 items-center gap-3">
            <input type="checkbox" value={folder.id} bind:group={chosen} />
            <span class="break-words">{folder.name}</span>
          </label>
        {/each}
        <label class="mt-2 flex flex-col gap-2">
          <span>New folder</span>
          <input
            bind:value={newFolder}
            type="text"
            autocomplete="off"
            class="min-h-11 rounded border border-ink bg-paper px-3"
            aria-describedby="new-folder-hint"
          />
          <span id="new-folder-hint" class="text-small text-muted">Optional. The feed goes in it when you save.</span>
        </label>
      </fieldset>

      <div class="flex flex-wrap gap-2">
        <button type="submit" aria-disabled={busy} class="min-h-11 rounded border border-ink px-4 font-semibold">Save</button>
        <button type="button" onclick={onCancel} class="min-h-11 rounded border border-ink px-4">Cancel</button>
      </div>
      <p role="status">{message}</p>
    </form>

    <section aria-labelledby="unsubscribe-heading" class="mt-10 flex max-w-xl flex-col items-start gap-2">
      <h3 id="unsubscribe-heading" class="text-large font-semibold">Unsubscribe</h3>
      <p>
        Stops following this feed and removes its articles. Starred articles stay in Starred. You can undo it straight
        afterwards.
      </p>
      <button type="button" aria-disabled={busy} onclick={leave} class="min-h-11 rounded border border-ink px-4">
        Unsubscribe from {feed.title}
      </button>
    </section>
  </div>
</section>
