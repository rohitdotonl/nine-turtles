<!--
  "Edit feed" (SPEC section 15): the feed's name, its folders as
  checkboxes, a new folder, and Unsubscribe. Saving changes the name and
  folders together; Cancel or Escape goes back to the feed unchanged.
  Unsubscribing happens at once, with Undo on the next screen. On a wide
  window it's a sheet over the feed's list; on a phone, a screen of its own.
-->
<script lang="ts">
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

{#snippet fields()}
  <label class="flex flex-col gap-2">
    <span class="font-semibold">Name</span>
    <input bind:value={title} type="text" autocomplete="off" class="field" />
  </label>

  <fieldset>
    <legend class="font-semibold">Folders</legend>
    {#if folders.length === 0}
      <p class="text-small text-muted">No folders yet. Name one below to make it.</p>
    {/if}
    {#each folders as folder (folder.id)}
      <label class="flex min-h-11 pointer-fine:min-h-9 items-center gap-3">
        <input type="checkbox" value={folder.id} bind:group={chosen} class="size-5 shrink-0" />
        <span class="break-words">{folder.name}</span>
      </label>
    {/each}
    <label class="mt-2 flex flex-col gap-2">
      <span class="font-semibold">New folder</span>
      <input bind:value={newFolder} type="text" autocomplete="off" class="field" aria-describedby="new-folder-hint" />
      <span id="new-folder-hint" class="text-small text-muted">Optional. The feed goes in it when you save.</span>
    </label>
  </fieldset>
{/snippet}

{#snippet unsubscribeHelp()}
  Stops following this feed and removes its articles. Starred articles stay in Starred. You can undo it straight afterwards.
{/snippet}

{#if sheet}
  <Sheet title="Edit feed" bind:heading onClose={onCancel}>
    <form onsubmit={save} class="flex flex-col gap-5">
      {@render fields()}
      <div class="flex flex-wrap items-center gap-2">
        <p role="status" class="mr-auto">{message}</p>
        <button type="button" onclick={onCancel} class="btn">Cancel</button>
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
      </div>
    </form>
    <!-- Unsubscribe sits apart, below a hairline: what it does, then the button. -->
    <div class="-mx-6 flex flex-col items-start gap-3 border-t border-ink/10 px-6 pt-4">
      <p class="text-small text-muted">{@render unsubscribeHelp()}</p>
      <button type="button" aria-disabled={busy} onclick={leave} class="btn max-w-full"><span class="truncate">Unsubscribe from {feed.title}</span></button>
    </div>
  </Sheet>
{:else}
<section aria-labelledby="list-heading" class="flex flex-1 flex-col bg-paper pt-3">
  <PageHead title="Edit feed" bind:heading onClose={onCancel} closeLabel="Close without saving" {besideToggle} />
  <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-10 md:px-10">
    <div class="mx-auto max-w-2xl">
      <form onsubmit={save} class="mt-6 flex max-w-xl flex-col gap-6">
        {@render fields()}

        <div class="flex flex-wrap gap-2">
          <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
          <button type="button" onclick={onCancel} class="btn">Cancel</button>
        </div>
        <p role="status">{message}</p>
      </form>

      <section aria-labelledby="unsubscribe-heading" class="mt-10 flex max-w-xl flex-col items-start gap-2 border-t border-ink/10 pt-8">
        <h3 id="unsubscribe-heading" class="text-large font-semibold">Unsubscribe</h3>
        <p>{@render unsubscribeHelp()}</p>
        <button type="button" aria-disabled={busy} onclick={leave} class="btn">
          Unsubscribe from {feed.title}
        </button>
      </section>
    </div>
  </div>
</section>
{/if}
