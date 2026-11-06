<!--
  Edit (SPEC section 36, decision 0163): a person's or publication's page,
  turned into its settings in place by its Edit button, the same for both.
  Done saves and turns it back; Cancel or Escape turns it back unchanged.

  Top to bottom (the owner's core path, points 11 to 13): their name; the
  email address Write back writes to (SPEC section 37); for one source,
  whether they're a person or a publication; the folders (one list for all
  their sources); for one source, its settings right here (Pause for a
  while), as it has no other. Then a person's sources, each a row whose ›
  opens that source's own settings, with "+ Add a source" under them; for a
  person with one source, no Sources heading, only a line near the foot
  inviting another place. Then Unsubscribe in red words at the foot,
  which leaves every source of theirs at once, with Undo on the next screen;
  when the reader kept something of theirs, it first asks whether that stays
  (KeepOrRemove, SPEC section 42).
-->
<script lang="ts">
  import { tick } from "svelte";
  import AddPlace from "./AddPlace.svelte";
  import Icon from "./Icon.svelte";
  import KeepOrRemove from "./KeepOrRemove.svelte";
  import SourceFields from "./SourceFields.svelte";
  import { editFeed, refused, type Notice } from "./feeds";
  import type { Sick } from "./health";
  import { keptAny, keptFrom, type Kept } from "./keeping";
  import type { LoadedLibrary } from "./library.svelte";
  import { PLACE_NAMES, placeShownAs, placesOf } from "./people";
  import type { Feed, Folder, WhoKind } from "./shapes";
  import { addressFor, keepAddress, looksLikeAddress } from "./writeBack";

  let {
    feed,
    folders,
    library,
    heading = $bindable(),
    onDone,
    onSource,
    onUnsubscribe,
    onPeople,
    onMoved,
    onFolders,
  }: {
    /** Their row's place: the one their address and list open at. */
    feed: Feed;
    folders: Folder[];
    library: LoadedLibrary;
    heading?: HTMLHeadingElement;
    /** Back to their page, saved or not. */
    onDone: (saved: boolean) => void;
    /** One of a person's sources, to open its own settings. */
    onSource: (id: number) => void;
    /** `removeKept`: what the reader starred or marked of theirs goes too (SPEC section 42). */
    onUnsubscribe: (removeKept: boolean) => Promise<string | undefined>;
    /** Sources were joined: their list, with "… · Undo". */
    onPeople: (done: Notice, lead: number) => void;
    onMoved: (feed: Sick) => void;
    /** Saved with a folder made or newly chosen: the sidebar opens them to show the person there (point 14). */
    onFolders?: (folders: number[]) => void;
  } = $props();

  const formId = $props.id();
  let places = $derived(placesOf(feed, library.feeds ?? []));
  let one = $derived(places.length === 1);
  // A last source still joined to someone (the others left elsewhere) is theirs: always a person, so no choice to offer.
  let chooses = $derived(one && feed.person == null);
  let name = $derived(library.shownAs(feed)?.title ?? feed.title);
  // The form starts from them as they are now, once.
  const start = (() => feed)();
  let title = $state((() => name)());
  const knownAddress = addressFor(start, (() => library.feeds ?? [])()) ?? "";
  let address = $state(knownAddress);
  let who: WhoKind = $state(start.kind ?? "person");
  let chosen: number[] = $state((() => [...new Set(placesOf(start, library.feeds ?? []).flatMap((place) => place.folders))])());
  let newFolder = $state("");
  let paused = $state(start.pausedAt != null);
  let shorts = $state(start.shorts === true);
  let liveStreams = $state(start.liveStreams === true);
  let busy = $state(false);
  let message = $state("");

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    message = "";
    // A wrong address is caught before anything is saved, keeping what was typed.
    // A publication has no address to keep (decision 0191): its field is hidden, so nothing typed there counts.
    const newAddress = who === "person" && address.trim() !== knownAddress;
    if (newAddress && address.trim() && !looksLikeAddress(address)) {
      message = "That doesn't look like an email address. Check it and try again.";
      return;
    }
    busy = true;
    const refusal = await editFeed(feed.id, {
      title,
      folders: chosen,
      newFolder,
      // Kept only when changed, so a stand-in shown before the first check is never stored as their choice.
      ...(chooses && who !== start.kind ? { kind: who } : {}),
      ...(one ? { paused, ...(feed.sortsVideos ? { shorts, liveStreams } : {}) } : {}),
    });
    const before = new Set(placesOf(start, library.feeds ?? []).flatMap((place) => place.folders));
    const madeName = newFolder.trim().toLowerCase();
    const problem = refusal ? refused(refusal, "feed") : newAddress ? await keepAddress(feed.id, address) : undefined;
    // Saved even if the address then failed: the sidebar shows what was kept.
    if (!refusal) {
      await library.loadFeeds();
      // A folder just made, or newly chosen, opens in the sidebar to show them in it.
      const shown = library.folders.filter((folder) => (!before.has(folder.id) && chosen.includes(folder.id)) || (madeName && folder.name.toLowerCase() === madeName)).map((folder) => folder.id);
      if (shown.length > 0) onFolders?.(shown);
    }
    busy = false;
    if (problem) message = problem;
    else onDone(true);
  }

  /** What the reader kept of theirs, while Unsubscribe asks whether to keep it (SPEC section 42). */
  let asking: Kept | undefined = $state();
  let leaveButton: HTMLButtonElement | undefined = $state();

  /** Unsubscribes; with something kept, asks first whether it stays (`removeKept` is the answer). */
  async function leave(removeKept?: boolean) {
    if (busy) return;
    busy = true;
    message = "";
    if (removeKept === undefined) {
      const kept = await keptFrom(feed.id);
      if (keptAny(kept)) {
        busy = false;
        asking = kept;
        return;
      }
    }
    const problem = await onUnsubscribe(removeKept ?? false);
    busy = false;
    if (problem) message = problem;
  }

  async function keepAsking() {
    asking = undefined;
    await tick();
    leaveButton?.focus();
  }
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-center justify-between gap-3">
    <h2 bind:this={heading} tabindex="-1" class="min-w-0 font-serif text-heading font-semibold break-words text-ink">Edit {name}</h2>
    <div class="flex shrink-0 gap-2">
      <button type="button" class="btn" onclick={() => onDone(false)}>Cancel</button>
      <button type="submit" form={formId} aria-disabled={busy} class="btn-primary">Done</button>
    </div>
  </div>

  <form id={formId} onsubmit={save} class="flex flex-col gap-5">
    <label class="flex flex-col gap-1.5">
      <span class="text-small text-ink-2">Name</span>
      <input bind:value={title} type="text" autocomplete="off" class="field" />
    </label>
    <!-- Where Write back writes: a person only, as a publication has no Write back (decision 0191). -->
    {#if who === "person"}
    <div class="flex flex-col gap-1.5">
      <label class="flex flex-col gap-1.5">
        <span class="text-small text-ink-2">Email address</span>
        <input bind:value={address} type="text" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false" class="field" aria-describedby="{formId}-address" />
      </label>
      <span id="{formId}-address" class="field-help mt-0">Write back opens your own email app with this address.</span>
    </div>
    {/if}

    {#if chooses}
      <!-- Someone or something (decision 0163): a choice of two, as Settings draws one. -->
      <fieldset class="flex min-w-0 flex-col gap-1.5">
        <legend class="mb-1.5 text-small text-ink-2">This is</legend>
        <div class="choices" style="--columns: 2">
          <label class="choice"><input type="radio" name="{formId}-who" value="person" bind:group={who} />A person</label>
          <label class="choice"><input type="radio" name="{formId}-who" value="publication" bind:group={who} />A publication</label>
        </div>
        <span class="field-help mt-0">{who === "person" ? "Listed under People." : "Listed under Publications."}</span>
      </fieldset>
    {/if}

    <fieldset class="flex min-w-0 flex-col gap-1.5">
      <legend class="mb-1.5 text-small text-ink-2">Folders</legend>
      <!-- A checklist (decision 0045): square tick boxes, as they can be in several; "New folder…" is the last row. -->
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
          <input bind:value={newFolder} type="text" autocomplete="off" placeholder="New folder…" class="inset-input" aria-describedby="{formId}-new-folder" />
        </label>
      </div>
      <span id="{formId}-new-folder" class="field-help mt-0">Type a name to make a folder.</span>
    </fieldset>

    {#if one}
      <SourceFields {feed} bind:paused bind:shorts bind:liveStreams {onMoved} />
    {/if}

    {#if !one}
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-small text-ink-2" id="{formId}-sources">Sources</span>
        <!-- Each source a row; its › opens that source's own settings. -->
        <ul class="inset-group" aria-labelledby="{formId}-sources">
          {#each places as each (each.id)}
            <li>
              <button type="button" class="inset-row w-full gap-3 text-left" aria-label="{PLACE_NAMES[each.place ?? "blog"]} {placeShownAs(each)}: its settings" onclick={() => onSource(each.id)}>
                <span class="w-24 shrink-0 text-muted">{PLACE_NAMES[each.place ?? "blog"]}</span>
                <span class="min-w-0 flex-1 break-words">{placeShownAs(each)}</span>
                <span aria-hidden="true" class="shrink-0 text-muted"><Icon name="chevron-right" size={18} /></span>
              </button>
            </li>
          {/each}
        </ul>
        <div class="mt-2">
          <AddPlace {feed} name={title.trim() || name} {library} onJoined={onPeople} />
        </div>
      </div>
    {:else if who === "person"}
      <!-- One source: no Sources heading, only a line near the foot inviting another place (point 12). -->
      <AddPlace {feed} name={title.trim() || name} {library} invite onJoined={onPeople} />
    {/if}

    <!-- A problem, in red words with an icon, only once there is one. -->
    <p role="status" class={["flex items-start gap-1.5 text-small text-danger", !message && "sr-only"]}>
      {#if message}<span class="mt-px shrink-0"><Icon name="alert" size={16} /></span>{message}{/if}
    </p>

    {#if asking}
      <KeepOrRemove {name} kept={asking} {busy} onChoose={(removeKept) => leave(removeKept)} onCancel={keepAsking} />
    {:else}
    <div class="inset-group">
      <button
        type="button"
        bind:this={leaveButton}
        aria-disabled={busy}
        aria-describedby="{formId}-leave"
        title="Stops following {one ? 'them' : 'every source of theirs'} and removes the articles; what you starred, highlighted or noted can stay. You can undo it straight afterwards."
        onclick={() => leave()}
        class="inset-row inset-action font-semibold text-danger">Unsubscribe from {name}</button
      >
    </div>
    {/if}
    <span id="{formId}-leave" class="sr-only">Removes their articles; what you starred, highlighted or noted can stay. You can undo it straight afterwards.</span>
  </form>
</div>

<style>
  .choices {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(min-content, 1fr));
  }
  .choices :global(.choice) {
    justify-content: center;
    text-align: center;
  }
</style>
