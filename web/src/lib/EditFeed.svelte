<!--
  "Edit feed" (SPEC section 15): the feed's name, its folders as a
  checklist ending in a "New folder…" row, and Unsubscribe. Saving changes the name and
  folders together; Cancel or Escape goes back to the feed unchanged.
  Unsubscribing happens at once, with Undo on the next screen. On a wide
  window it's a sheet over the feed's list; on a phone, a screen of its own.

  In the sheet, one row of actions at the foot, in a Mac sheet's order:
  Unsubscribe in red words at the far left, apart from the rest, then Cancel
  and Save at the right end (decision 0039). On a phone, the phone sheet's
  one build (decision 0052): an X beside the title is the way out (no
  Cancel), Unsubscribe is the one row of a group of its own, and Save takes
  the full width at the screen's foot, at least 32px below it.
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

{#snippet unsubscribe(look: string)}
  <button
    type="button"
    aria-disabled={busy}
    aria-describedby="unsubscribe-help"
    title="Stops following this feed and removes its articles; starred ones stay. You can undo it straight afterwards."
    aria-label="Unsubscribe from {feed.title}"
    onclick={leave}
    class={look}>Unsubscribe</button
  >
  <span id="unsubscribe-help" class="sr-only">Removes its articles; starred ones stay. You can undo it straight afterwards.</span>
{/snippet}

{#snippet form()}
  <form onsubmit={save} class={["flex flex-col gap-5", !sheet && "flex-1"]}>
    <label class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">Name</span>
      <input bind:value={title} type="text" autocomplete="off" class="field" />
    </label>

    <fieldset class="flex min-w-0 flex-col gap-1.5">
      <legend class="mb-1.5 text-small text-ink-2">Folders</legend>
      <!--
        A checklist, as Apple lists choices: each folder a 44px row ending in a
        tick box, a rounded square, empty when the feed isn't in it and filled
        with a check when it is (decision 0045). Square, because a feed can be
        in several folders; a round mark would read as "pick one". "New
        folder…" is the list's last row, a text box of its own.
      -->
      <div class="inset-group">
        {#each folders as folder (folder.id)}
          <label class="inset-row check-row">
            <input type="checkbox" value={folder.id} bind:group={chosen} />
            <span class="min-w-0 break-words">{folder.name}</span>
            <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
          </label>
        {/each}
        <label class="inset-row">
          <span class="sr-only">New folder</span>
          <input
            bind:value={newFolder}
            type="text"
            autocomplete="off"
            placeholder="New folder…"
            class="inset-input"
            aria-describedby="new-folder-hint"
          />
        </label>
      </div>
      <!-- On the field's own left edge, 6px under it (the fieldset's gap). -->
      <span id="new-folder-hint" class="field-help mt-0"
        >{folders.length === 0 ? "No folders yet. " : ""}Optional: a new folder is made when you save, with this feed in it.</span
      >
    </fieldset>

    <!-- A problem, in red words with an icon, only once there is one: the sheet grows by its line. -->
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>

    {#if sheet}
      <!-- One row at the foot: Unsubscribe at the far left, then Cancel and Save at the right end. -->
      <div class="sheet-actions">
        {@render unsubscribe("btn-danger")}
        <button type="button" onclick={onCancel} class="btn">Cancel</button>
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
      </div>
    {:else}
      <!-- On a phone: Unsubscribe as a group of its own, a red row (its word says what it does), then Save at the foot, at least 36px below it. -->
      <div class="inset-group">
        {@render unsubscribe("inset-row inset-action text-danger font-semibold")}
      </div>
      <div class="page-action">
        <button type="submit" aria-disabled={busy} class="btn-primary">Save</button>
      </div>
    {/if}
  </form>
{/snippet}

{#if sheet}
  <Sheet title="Edit feed" bind:heading onClose={onCancel}>
    {@render form()}
  </Sheet>
{:else}
<section aria-labelledby="list-heading" class="page-sheet">
  <!--
    The phone sheet's build (decisions 0052, 0055): an iOS page sheet, its grouped ground 10px
    below the dimmed screen's top with 12px top corners, the title with an X that goes back
    unchanged (as Escape does), no Cancel. Its form starts 20px under the top line, as Settings'
    first group does, the folders and Unsubscribe are cards on the ground, and Save sits at the
    screen's foot.
  -->
  <div class="page-sheet-card">
    <PageHead title="Edit feed" bind:heading {besideToggle} onClose={onCancel} closeLabel="Close" />
    <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
      <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
        {@render form()}
      </div>
    </div>
  </div>
</section>
{/if}
