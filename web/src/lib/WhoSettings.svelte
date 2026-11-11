<!--
  A person's or publication's settings, on their own page (SPEC section 36):
  no Edit mode, no Cancel or Done. Each setting changes the moment it's
  touched, as Settings' own do (principle 8, instant and still), and the
  page itself shows it: the name at the top, their row in the sidebar, the
  switch. Built as Settings' rows (an inset group), top to bottom: Name
  (saved on Enter or on leaving the field; Escape puts it back), This is
  (for one source on its own), Folders (the folders they're in, opening in
  place to the tick list Add and Edit folder use, with New folder… as its
  last row), Pause for a while (every source of theirs at once), and Hide
  articles about… ›. Under the group, the sources' own settings (TheirPlaces,
  the `sources` snippet), then, apart, Unsubscribe in oxblood words, which
  asks first whether what was kept stays (KeepOrRemove) and has Undo on the
  next screen.
-->
<script lang="ts">
  import { tick, type Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import KeepOrRemove from "./KeepOrRemove.svelte";
  import { editFeed, type FeedChanges, type Refusal } from "./feeds";
  import SettingSwitch from "./SettingSwitch.svelte";
  import VideoSwitches from "./VideoSwitches.svelte";
  import { keptAny, keptFrom, type Kept } from "./keeping";
  import type { LoadedLibrary } from "./library.svelte";
  import { placesOf } from "./people";
  import type { Feed, WhoKind } from "./shapes";

  let {
    feed,
    library,
    nameField = $bindable(),
    onSaved,
    onFolders,
    onHide,
    onUnsubscribe,
    sources,
  }: {
    feed: Feed;
    library: LoadedLibrary;
    /** The Name field: `e` and the old Edit address bring the keyboard here. */
    nameField?: HTMLInputElement;
    /** Something was saved: their list refreshes (an unpaused source's newest come back). */
    onSaved: () => void;
    /** A folder just made or chosen: the sidebar opens it to show them there. */
    onFolders?: (folders: number[]) => void;
    onHide: () => void;
    /** `removeKept`: what the reader starred or marked of theirs goes too (SPEC section 42). */
    onUnsubscribe: (removeKept: boolean) => Promise<string | undefined>;
    /** Their sources' own settings, between this group and Unsubscribe, saving through the same queue. */
    sources?: Snippet<[Save]>;
  } = $props();

  const id = $props.id();
  let places = $derived(placesOf(feed, library.feeds ?? []));
  let one = $derived(places.length === 1);
  // A last source still joined to someone is theirs: always a person, so no choice to offer.
  let chooses = $derived(one && feed.person == null);
  let name = $derived(library.shownAs(feed)?.title ?? feed.title);
  let folders = $derived(library.folders);

  // What the controls show: what's saved, and, while a change is on its way, the change.
  let title = $state((() => name)());
  let editing = $state(false);
  $effect(() => {
    if (!editing) title = name;
  });
  let who: WhoKind = $derived(feed.kind ?? "person");
  let saved: number[] = $derived([...new Set(places.flatMap((place) => place.folders))]);
  /** The folders as last ticked, while their saving is on its way; then what's saved again. */
  let ticked: number[] | undefined = $state();
  let chosen = $derived(ticked ?? saved);
  let paused = $derived(places.length > 0 && places.every((place) => place.pausedAt != null));

  let message = $state("");
  let busy = $state(false);

  /** What a refused change says here, in the reader's words: these screens never say "feed" (SPEC section 36). */
  function whyNot(refusal: Refusal): string {
    if (refusal === "no-name") return "Give them a name.";
    if (refusal === "already") return "There's already a folder with that name.";
    if (refusal === "gone") return "You don't follow them any more.";
    return "That couldn't be saved. Try again in a moment.";
  }

  /**
   * Saves one change to every place it belongs to (a person's name and folders are kept on any of theirs).
   * Changes go one after another, in the order they were made, so two quick presses never land the wrong way round.
   */
  type Save = (changes: FeedChanges, on?: number[]) => Promise<boolean>;
  let queue: Promise<unknown> = Promise.resolve();
  const save: Save = (changes, on = [feed.id]) => {
    const done = queue.then(async () => {
      message = "";
      for (const place of on) {
        const refusal = await editFeed(place, changes);
        if (refusal) {
          message = whyNot(refusal);
          await library.loadFeeds();
          return false;
        }
      }
      await library.loadFeeds();
      onSaved();
      return true;
    });
    queue = done;
    return done;
  };

  /** Keeps a new name, on Enter or on leaving the field. Refused, the typed name stays in the field, with why. */
  let keeping = "";
  async function rename() {
    const wanted = title.trim();
    if (wanted === name || wanted === keeping) {
      if (wanted === name) editing = false;
      return;
    }
    if (!wanted) {
      editing = false;
      title = name;
      message = "Give them a name.";
      return;
    }
    keeping = wanted;
    renamed = await save({ title: wanted });
    keeping = "";
    // Only once it's kept does the field follow the saved name again; refused, what was typed stays.
    if (renamed && document.activeElement !== nameField) editing = false;
  }
  /** "Saved." under Name once a new name is kept, until the field is used again: the field itself doesn't change, so a word does. */
  let renamed = $state(false);

  function nameKeys(event: KeyboardEvent) {
    if (event.key === "Enter") {
      // Kept where it is: the keyboard stays in the field.
      event.preventDefault();
      void rename();
    } else if (event.key === "Escape" && title !== name) {
      // Escape puts the name back, and only a second one leaves the page.
      event.stopPropagation();
      title = name;
    }
  }

  async function chooseWho(next: WhoKind) {
    if (next === who) return;
    await save({ kind: next });
  }

  async function toggleFolder(folder: number, on: boolean) {
    const next = on ? [...new Set([...chosen, folder])] : chosen.filter((each) => each !== folder);
    ticked = next;
    await save({ folders: next });
    if (ticked === next) ticked = undefined;
  }

  // Folders: the ones they're in, in words, opening in place to the whole tick list.
  let showFolders = $state(false);
  let inWords = $derived.by(() => {
    const names = folders.filter((folder) => chosen.includes(folder.id)).map((folder) => folder.name);
    if (names.length === 0) return "None";
    return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  });
  let newFolder = $state("");

  async function makeFolder(event: SubmitEvent) {
    event.preventDefault();
    const wanted = newFolder.trim();
    if (!wanted) return;
    const before = new Set(folders.map((folder) => folder.id));
    if (await save({ folders: chosen, newFolder: wanted })) {
      const made = library.folders.filter((folder) => !before.has(folder.id) || folder.name.toLowerCase() === wanted.toLowerCase()).map((folder) => folder.id);
      if (made.length > 0) onFolders?.(made);
      newFolder = "";
    }
  }

  async function pause(on: boolean) {
    await save({ paused: on }, places.map((place) => place.id));
  }

  /** What the reader kept of theirs, while Unsubscribe asks whether to keep it (SPEC section 42). */
  let asking: Kept | undefined = $state();
  let leaveButton: HTMLButtonElement | undefined = $state();

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

<section class="flex flex-col gap-2" aria-labelledby="{id}-heading" lang="en">
  <h3 id="{id}-heading" class="label">Settings</h3>
  <div class="inset-group">
    <label class="inset-row setting has-control">
      <span class="setting-words">
        <span class="setting-name">Name</span>
        <span role="status" class={["setting-hint", !renamed && "sr-only"]}>{renamed ? "Saved." : ""}</span>
      </span>
      <input
        bind:this={nameField}
        bind:value={title}
        onfocus={() => ((editing = true), (renamed = false))}
        onblur={() => void rename()}
        onkeydown={nameKeys}
        type="text"
        aria-label="Name"
        autocomplete="off"
        enterkeyhint="done"
        class="field setting-control"
      />
    </label>

    {#if chooses}
      <!-- Someone or something (decision 0163): a choice of two, as Settings draws one. -->
      <div class="inset-row setting has-control">
        <span id="{id}-who" class="setting-name">This is</span>
        <div role="radiogroup" aria-labelledby="{id}-who" class="choices setting-control" style="--columns: 2; --phone-columns: 2">
          <label class="choice"><input type="radio" name="{id}-who" value="person" checked={who === "person"} onchange={() => void chooseWho("person")} /><Icon name="person" />A person</label>
          <label class="choice"><input type="radio" name="{id}-who" value="publication" checked={who === "publication"} onchange={() => void chooseWho("publication")} /><Icon name="newspaper" />A publication</label>
        </div>
      </div>
    {/if}

    <!-- The folders they're in, in words; pressed, the tick list opens in place (decision 0045's square tick boxes). -->
    <button type="button" class="inset-row inset-action setting w-full text-left" aria-expanded={showFolders} aria-controls="{id}-folders" onclick={() => (showFolders = !showFolders)}>
      <span class="setting-name shrink-0">Folders</span>
      <span class="ml-auto flex min-w-0 items-center gap-2 text-muted">
        <span class="min-w-0 truncate">{inWords}</span>
        <Icon name={showFolders ? "chevron-up" : "chevron-down"} />
      </span>
    </button>
    {#if showFolders}
      <div id="{id}-folders" role="group" aria-label="Folders" class="contents">
        {#each folders as folder (folder.id)}
          <label class="inset-row check-row nested">
            <input type="checkbox" checked={chosen.includes(folder.id)} onchange={(event) => void toggleFolder(folder.id, event.currentTarget.checked)} />
            <span class="min-w-0 break-words">{folder.name}</span>
            <span aria-hidden="true" class="check-mark shrink-0"><Icon name="check" size="tick" /></span>
          </label>
        {/each}
        <form class="inset-row nested new-folder" onsubmit={makeFolder}>
          <label class="sr-only" for="{id}-new">New folder</label>
          <input id="{id}-new" bind:value={newFolder} onkeydown={(event) => event.key === "Escape" && newFolder && (event.stopPropagation(), (newFolder = ""))} type="text" autocomplete="off" enterkeyhint="done" placeholder="New folder…" class="inset-input" aria-describedby="{id}-new-help" />
          <!-- Kept (decision 0241): a placeholder disappears once you type, so this is the field's visible name then (first floor). -->
          <span id="{id}-new-help" class="setting-hint">Type a name and press Enter to make a folder.</span>
        </form>
      </div>
    {/if}

    <SettingSwitch name="Pause for a while" hint="Their new articles arrive already read while this is on." checked={paused} onchange={(on) => void pause(on)} />

    {#if one && feed.sortsVideos}
      <!-- A YouTube channel on its own (decision 0144): both off by default, changed the moment they're switched. -->
      <VideoSwitches source={feed} {save} />
    {/if}

    <!-- It goes to Settings › Hiding, with the field set to them: a row that leads on, so it ends in ›. -->
    <button type="button" class="inset-row inset-action setting w-full text-left" onclick={onHide}>
      <span class="setting-name">Hide articles about…</span>
      <span aria-hidden="true" class="ml-auto text-muted"><Icon name="chevron-right" /></span>
    </button>
  </div>
  <p role="status" class={["inset-foot flex items-start gap-2 text-danger", !message && "sr-only"]}>
    {#if message}<span class="mt-px shrink-0"><Icon name="alert" /></span>{/if}{message}
  </p>

  {@render sources?.(save)}

  <div class="mt-8">
    {#if asking}
      <KeepOrRemove {name} kept={asking} {busy} onChoose={(removeKept) => leave(removeKept)} onCancel={keepAsking} />
    {:else}
      <div class="inset-group">
        <button
          type="button"
          bind:this={leaveButton}
          aria-disabled={busy}
          aria-describedby="{id}-leave"
          title="Stops following {one ? 'them' : 'every source of theirs'} and removes the articles; what you starred, highlighted or noted can stay. You can undo it straight afterwards."
          onclick={() => leave()}
          class="inset-row inset-action font-semibold text-danger">Unsubscribe from {name}</button
        >
      </div>
    {/if}
    <span id="{id}-leave" class="sr-only">Removes their articles; what you starred, highlighted or noted can stay. You can undo it straight afterwards.</span>
  </div>
</section>

<style>
  /* The two choices share the control evenly, as Settings' own do (decision 0120). */
  .choices.setting-control {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(min-content, 1fr));
  }
  .choices.setting-control :global(.choice) {
    justify-content: center;
    padding-inline: 0.5rem;
  }
  /* The row after the opened folders keeps its hairline, as the wrapper between them breaks the usual pairing. */
  .contents + :global(.inset-row)::before {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    left: 1rem;
    border-top: 1px solid var(--line);
  }
  .new-folder {
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
  }
  /* A folder's tick row sits one step in, under Folders, so the list reads as its contents. */
  .nested {
    padding-left: 2rem;
  }
  .nested::before {
    left: 2rem !important;
  }
</style>
