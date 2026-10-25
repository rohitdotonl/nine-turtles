<!--
  "Edit feed" (SPEC section 15): the feed's name, its folders as a
  checklist ending in a "New folder…" row, its own settings (reading mode,
  how often it's checked, opening on the website), and Unsubscribe. Saving
  changes them all together; Cancel or Escape goes back to the feed unchanged.
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
  import { editFeed, refused, type Check, type Feed, type Folder } from "./feeds";

  let {
    feed,
    folders,
    heading = $bindable(),
    besideToggle = false,
    sheet = false,
    river = false,
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
    /** The whole app is in river mode, so every feed flows past whatever this one says. */
    river?: boolean;
    onSaved: () => void;
    onCancel: () => void;
    onUnsubscribe: () => Promise<string | undefined>;
  } = $props();

  // The form starts from the feed as it is now, once.
  let title = $state((() => feed.title)());
  let chosen: number[] = $state((() => [...feed.folders])());
  let newFolder = $state("");
  let flows = $state((() => feed.river)());
  let check: Check = $state((() => feed.check)());
  let openOnSite = $state((() => feed.openOnSite)());
  let busy = $state(false);
  let message = $state("");

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    message = "";
    const refusal = await editFeed(feed.id, title, chosen, newFolder, { river: flows, check, openOnSite });
    busy = false;
    if (refusal) message = refused(refusal, "feed");
    else onSaved();
  }

  const MODE_CHOICES = [
    { value: false, label: "Inbox" },
    { value: true, label: "River" },
  ];
  const CHECK_CHOICES: { value: Check; label: string }[] = [
    { value: "automatic", label: "Automatic" },
    { value: "hourly", label: "Hourly" },
    { value: "daily", label: "Daily" },
  ];

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

    <!--
      The feed's own settings, a grouped list as in Settings: each row's name on its left and a
      segmented choice at its right end (under the name when narrow), then a tick box row. Every
      setting starts as every feed behaves, so only the feeds that need it change.
    -->
    <div class="flex min-w-0 flex-col gap-1.5">
      <span class="text-small text-ink-2" id="feed-settings-name">Settings</span>
      <div class="inset-group" role="group" aria-labelledby="feed-settings-name" aria-describedby="feed-settings-help">
        <fieldset class="inset-row">
          <legend class="row-name">Reading mode</legend>
          <div class="choices control" style="--columns: 2">
            {#each MODE_CHOICES as choice (choice.label)}
              <label class="choice">
                <input type="radio" name="feed-mode" value={choice.value} bind:group={flows} />
                {choice.label}
              </label>
            {/each}
          </div>
        </fieldset>
        <fieldset class="inset-row">
          <legend class="row-name">Check for new articles</legend>
          <div class="choices control" style="--columns: 3">
            {#each CHECK_CHOICES as choice (choice.value)}
              <label class="choice">
                <input type="radio" name="feed-check" value={choice.value} bind:group={check} />
                {choice.label}
              </label>
            {/each}
          </div>
        </fieldset>
        <label class="inset-row check-row">
          <input type="checkbox" bind:checked={openOnSite} />
          <span class="min-w-0 break-words">Open articles on the website</span>
          <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size={14} /></span>
        </label>
      </div>
      <span id="feed-settings-help" class="field-help mt-0"
        >{river
          ? "The whole app is in river mode for now (Settings › Reading)."
          : "River: its articles skip Unread and show no count."}
        Hourly or Daily: checked no more often than that. Website: opening an article goes to the publisher's page.</span
      >
    </div>

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

<style>
  /* The same rows as Settings.svelte's (keep the two alike): a row's name on its left; a fieldset's legend floats so it sits in the row like any other child. */
  .row-name {
    float: left;
    padding: 0;
    color: var(--ink);
    font-size: var(--text-ui);
  }
  /* The choice at the row's right end, as wide as it needs; under the name once the row is too narrow. */
  .control {
    flex: 0 1 15rem;
    min-width: 0;
  }
  .choices.control {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  }
  .choices.control :global(.choice) {
    justify-content: center;
    padding-inline: 0.5rem;
    text-align: center;
    line-height: 1.2;
  }
  @media (width < 40rem) {
    .control {
      flex-basis: 100%;
    }
  }
</style>
