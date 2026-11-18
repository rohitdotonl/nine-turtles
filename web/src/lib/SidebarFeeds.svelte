<!--
  The sidebar's folders and feeds (SPEC section 5): folders in the reader's
  own order (decision 0207), each
  with a button that
  shows or hides the people and publications in it, then those in no
  folder, A to Z, under two headings: People, then Publications (decision
  0163). One in two folders is listed under both. Which folders are open is
  remembered on this device.

  As in a Mac source list (decision 0041), a folder's show-or-hide arrow
  sits before its name. No row here says what's unread (decision 0242):
  Unread's own dot does, above them. Unread, Saved and All start their names 46px
  into the sidebar, after their icons; folders, and the people and
  publications in no folder, start at the 20px margin; a folder's feeds
  start one step in, on the 46px edge, so an indent always means "inside a
  folder" (decisions 0043, 0225).

  On a phone the feeds screen is the root of a stack: nothing is marked as
  selected there, and every row ends in a chevron, because
  it leads on to a screen of its own. So a folder there has no arrow of its
  own (one chevron per row): its feeds are always listed under it, a step
  in, and a tap on its name opens its list (decision 0043).

  While the sidebar search holds text, a flat list of the folders and feeds
  whose name contains it takes their place.

  Arranging (decision 0207): a folder drags up or down, and a person or
  publication drags onto a folder, out of one, or between People and
  Publications (sidebarDrag.ts: a mouse drags at once, a finger presses and
  holds first). Edit, beside Folders, gives every row a handle for those who
  don't drag: a folder's opens Move up, Move down…, a person's "Move to a
  folder". What was done shows in a note at the sidebar's foot, with Undo.
  Dropped on the foot's Pause or Unsubscribe (decision 0248), they're paused
  or unsubscribed from, with Undo; if the reader starred, highlighted or
  noted anything of theirs, the foot first asks whether to keep it, as
  Edit's Unsubscribe does (KeepOrRemove). A link dropped anywhere on nine
  turtles, or on a folder here, opens "Follow <name>?" (linkDrop.svelte.ts);
  a list of feeds dropped there is imported, said in the same note. Someone
  dropped onto someone else makes the two one person, under the name of the
  one dropped on (decision 0250).
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import Icon from "./Icon.svelte";
  import Portrait from "./Portrait.svelte";
  import { home as homeDesign, LOOKS } from "./homeStyle.svelte";
  import { chosenPicture } from "./portrait";
  import type { Snippet } from "svelte";
  import KeepOrRemove from "./KeepOrRemove.svelte";
  import { keptAny, keptFrom, type Kept } from "./keeping";
  import { droppedOn, listenForDrops } from "./linkDrop.svelte";
  import MoreMenu from "./MoreMenu.svelte";
  import MoveSheet from "./MoveSheet.svelte";
  import TextButton from "./TextButton.svelte";
  import type { Feed, Folder } from "./shapes";
  import { findByName, folderChoice, folderUnread, inDevanagari, plainSourceName } from "./feeds";
  import { droppedBefore, placeWords, STEP_WORDS, stepped, stepsFor, type Step } from "./arranging";
  import type { LoadedLibrary, Removed } from "./library.svelte";
  import { UNDO_FAILED, UNDONE } from "./messages";
  import { addressFor, pathFor, type Route } from "./router";
  import { dragValue, sidebarDrag, type Dragged, type Over } from "./sidebarDrag";

  let {
    library,
    route,
    search,
    follow,
    phone = false,
    unreadOff = false,
    searchArticles,
    onLeft,
    onBack,
    onLink,
    yours,
    editing = $bindable(false),
  }: {
    /** The reader's people and folders, and the ways to arrange them. */
    library: LoadedLibrary;
    route: Route;
    /** What's typed in the sidebar search. */
    search: string;
    follow: (event: MouseEvent, next: Route) => void;
    /** The phone's feeds screen: no selection, and a chevron on every row. */
    phone?: boolean;
    /** Unread off: no unread state on the rows, even for the tests. */
    unreadOff?: boolean;
    /** Searches every article for what's typed in the sidebar search (decision 0231). */
    searchArticles: (words: string) => void;
    /** Unsubscribed from by a drop: if their list or page is open, it closes; any other list lets go of their articles at once (`kept`: Keep them was the answer). */
    onLeft: (row: Feed, kept: boolean) => void;
    /** Undo brought them back after a drop: the list shows their articles again. */
    onBack: () => void;
    /** A web address was dropped on nine turtles: "Follow <name>?" opens for it. */
    onLink: (address: string) => void;
    /** Home redesign, design round: Saved and Notes, drawn after the folders. Given, Home is in the new order. */
    yours?: Snippet;
    /** Edit: every row has a handle, for moving without dragging. */
    editing?: boolean;
  } = $props();

  /** Home redesign, design round: which version, and what it changes (homeStyle.svelte.ts → LOOKS). */
  let redesign = $derived(yours ? homeDesign.style : "now");
  let L = $derived(LOOKS[redesign]);
  /** No headings to see: space or lines part the groups. */
  let bold = $derived(L?.headings === "hidden");
  /** A sign before every heading. */
  let signs = $derived(L?.headIcons === "all" || L?.cardNames === "signs");

  let feeds: Feed[] = $derived(library.rows ?? []);
  let folders: Folder[] = $derived(library.folders);
  let order = $derived(folders.map((folder) => folder.id));
  /** Which folders are open: the library keeps it, so a folder Undo makes again opens as it was. */
  let open: number[] = $derived(library.openFolders);
  /** Edit: every row has a handle, for moving without dragging. */
  // (Home redesign, design round: bindable, so bold's Edit can sit beside the wordmark.)
  /** Someone whose handle opened "Move to a folder". */
  let moving: Feed | undefined = $state();
  /** What the last arranging did (with Undo), or a sentence saying why it didn't. */
  let note: Removed | undefined = $state();
  /** Said only to screen readers with the note: where a moved folder is now ("Friends is 2 of 5."). */
  let where = $state("");
  /** Why the person held over Publications can't go there, under its heading. */
  let refusal = $state("");
  /** Dropped on Unsubscribe, with something kept: the foot asks whether it stays. */
  let asking: { row: Feed; kept: Kept } | undefined = $state();
  let leaving = $state(false);

  /** The folders open now: Shift+J and Shift+K pass over the feeds in the others (decision 0110). */
  export function openFolders(): number[] {
    return open;
  }

  /** Edit put the person in these folders: they open, to show them there (the owner's core path, point 14). */
  function openFolder(ids: number[]) {
    library.setOpen([...new Set([...open, ...ids])]);
  }

  function toggle(id: number) {
    library.setOpen(open.includes(id) ? open.filter((each) => each !== id) : [...open, id]);
  }

  /**
   * `e`: expands or collapses a folder, as its arrow does (decision 0103). If the
   * keyboard's place was on one of the feeds it hides, it moves to the
   * folder's own row rather than being lost.
   */
  export function toggleFolder(id: number) {
    if (phone) return;
    const inside = document.getElementById(`folder-${id}`)?.contains(document.activeElement) ?? false;
    toggle(id);
    if (inside) queueMicrotask(() => document.querySelector<HTMLElement>(`[data-folder-link="${id}"]`)?.focus());
  }

  const folderNamed = (id: number | null) => folders.find((folder) => folder.id === id) ?? null;
  const rowNamed = (id: number) => feeds.find((feed) => feed.id === id);

  /** Someone in more than one place stays a person (section 36): they can't be a publication. */
  function several(row: Feed): boolean {
    return (row.places?.length ?? 1) > 1;
  }

  /** Whether letting go of `dragged` over `over` would change anything. */
  function accepts(dragged: Dragged, over: Over): boolean {
    if (dragged.kind === "folder") return over?.kind === "between" && droppedBefore(order, dragged.id, over.before).join() !== order.join();
    const row = rowNamed(dragged.id);
    if (!row || !over || over.kind === "between") return false;
    if (over.kind === "act") return over.act === "unsubscribe" || !library.allPaused(row);
    if (over.kind === "person") return over.id !== row.id && !(row.places ?? [row.id]).includes(over.id);
    if (over.kind === "folder") return !row.folders.includes(over.id);
    if (over.who === "publication" && several(row)) return false;
    return dragged.from !== null || over.who !== (row.kind ?? "person");
  }

  /** Held over Publications, someone in several places is told why they can't go there; let go anyway, the note says it too. */
  function refuse(dragged: Dragged, over: Over, dropped = false) {
    const row = dragged.kind === "person" ? rowNamed(dragged.id) : undefined;
    const why = row && over?.kind === "loose" && over.who === "publication" && several(row) ? `${row.title} writes in more than one place, so stays under People.` : "";
    refusal = dropped ? "" : why;
    // Let go on Pause when they're paused already: the note says so.
    if (dropped && row && over?.kind === "act") void arranged(library.pause(row));
    if (dropped && why) {
      note = why;
      where = "";
    }
  }

  async function drop(dragged: Dragged, over: Over, keep: boolean) {
    if (dragged.kind === "folder" && over?.kind === "between") {
      const folder = folderNamed(dragged.id);
      if (folder) await arranged(library.orderFolders(droppedBefore(order, folder.id, over.before), folder), folder);
      return;
    }
    const row = dragged.kind === "person" ? rowNamed(dragged.id) : undefined;
    if (!row || !over || dragged.kind !== "person") return;
    const from = folderNamed(dragged.from);
    if (over.kind === "folder") {
      const to = folderNamed(over.id);
      await arranged(library.file(row, from, to, keep));
      if (to) openFolder([to.id]);
    } else if (over.kind === "person") {
      const into = rowNamed(over.id);
      if (into) await arranged(library.joinInto(row, into));
    } else if (over.kind === "act") {
      if (over.act === "pause") await arranged(library.pause(row));
      else await leave(row);
    } else if (over.kind === "loose") {
      // Out of a folder onto People or Publications: out of it, and the one dropped on.
      await arranged(from ? library.file(row, from, null, false, over.who) : library.makeKind(row, over.who));
    }
  }

  /** Held over someone else, the lifted name says what letting go makes (decision 0250). */
  function ghostText(_dragged: Dragged, over: Over): string | undefined {
    return over?.kind === "person" ? `One person with ${rowNamed(over.id)?.title ?? ""}` : undefined;
  }

  /** Unsubscribes from someone dropped on Unsubscribe; with something kept, asks first (`removeKept` is the answer). */
  async function leave(row: Feed, removeKept?: boolean) {
    if (leaving) return;
    leaving = true;
    if (removeKept === undefined) {
      const kept = await keptFrom(row.id);
      if (keptAny(kept)) {
        leaving = false;
        note = undefined;
        asking = { row, kept };
        return;
      }
    }
    const done = await library.unsubscribe(row, removeKept ?? false);
    leaving = false;
    asking = undefined;
    if (typeof done !== "string") onLeft(row, removeKept === false);
    note = typeof done !== "string" && done.undo ? { ...done, undo: () => done.undo!().finally(onBack) } : done;
    where = "";
    // The question's buttons are gone: the keyboard goes to the note's Undo (or Close).
    await tick();
    document.querySelector<HTMLElement>("#sidebar .sidebar-note-band button")?.focus();
  }

  /** Cancel (or Escape) in the foot's question: nothing changes, and the keyboard goes back to their row. */
  async function stay(row: Feed) {
    asking = undefined;
    await tick();
    document.querySelector<HTMLElement>(`#sidebar li[data-drag^="person:${row.id}:"] a`)?.focus();
  }

  onMount(() =>
    listenForDrops({
      onLink: (address, folder) => {
        const into = folderNamed(folder);
        droppedOn.folder = into ? { id: into.id, name: into.name } : null;
        onLink(address);
      },
      onFile: (file) => {
        note = "Importing…";
        void arranged(library.importFile(file));
      },
    }),
  );

  /** A handle's menu moved a folder: the keyboard stays on its handle. */
  async function step(folder: Folder, how: Step) {
    await arranged(library.orderFolders(stepped(order, folder.id, how), folder), folder);
    await tick();
    document.querySelector<HTMLElement>(`[data-folder-item="${folder.id}"] [data-handle] button`)?.focus();
  }

  /** A person's handle moved them with "Move to a folder". */
  async function moveTo(folder: Folder | null, naming: string): Promise<string | undefined> {
    if (!moving) return undefined;
    const done = await library.moveTo(moving, folder, naming);
    if (typeof done === "string") return done;
    const handle = moving.id;
    moving = undefined;
    note = done;
    where = "";
    await tick();
    document.querySelector<HTMLElement>(`[data-handle-for="${handle}"]`)?.focus();
    return undefined;
  }

  /** An arranging finished: the note says what, with Undo, or why it couldn't be done. */
  async function arranged(doing: Promise<Removed | undefined>, folder?: Folder) {
    asking = undefined;
    const done = await doing;
    if (done === undefined) return;
    note = done;
    where = folder && typeof done !== "string" ? `${folder.name} is ${placeWords(order, folder.id)}.` : "";
  }

  async function undo() {
    if (!note || typeof note === "string" || !note.undo) return;
    const undoing = note.undo;
    note = UNDONE;
    where = "";
    note = (await undoing().catch(() => UNDO_FAILED)) ?? UNDONE;
  }

  // Edit ends with the last folder, as its Done goes with the Folders heading.
  $effect(() => {
    if (folders.length === 0) editing = false;
  });

  let searching = $derived(search.trim() !== "");
  let found = $derived(findByName({ feeds, folders }, search));
  let loose = $derived(feeds.filter((feed) => feed.folders.length === 0));
  /** Someone or something (decision 0163): the rows in no folder, under two headings. */
  let pinned = $derived(redesign === "now" ? [] : homeDesign.pins.map((id) => feeds.find((feed) => feed.id === id)).filter((feed): feed is Feed => !!feed));
  let people = $derived(loose.filter((feed) => feed.kind !== "publication" && !pinned.includes(feed)));
  let publications = $derived(loose.filter((feed) => feed.kind === "publication"));

  function isHere(place: Route): boolean {
    // The phone's feeds screen shows no selection: you're at the root, not in a place.
    return !phone && pathFor(place) === pathFor(route);
  }
</script>

<!--
  A name alone: folders, people and publications carry no unread dot (decision
  0242); only Unread above them does. How many are unread stays only as the
  row's `data-unread`, unseen and unheard, for the tests.
-->
{#snippet name(text: string)}
  <!-- Devanagari a touch larger, so it sits level with Latin names (decision 0041). -->
  <span class={["min-w-0 flex-1 truncate", inDevanagari(text) && "devanagari"]}><bdi>{text}</bdi></span>
{/snippet}

{#snippet leadsOn()}
  {#if phone && !editing}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" /></span>{/if}
{/snippet}

<!-- In Edit, a person's handle: drag it, or press it for "Move to a folder". -->
{#snippet personHandle(feed: Feed)}
  {#if editing}
    <button
      type="button"
      data-handle
      data-handle-for={feed.id}
      aria-label={`Move ${feed.title}`}
      title={`Move ${feed.title}`}
      onclick={() => (moving = feed)}
      class="handle btn-quiet absolute inset-y-0 right-2 flex w-9 pointer-coarse:w-11 items-center justify-center rounded-press text-muted"
      ><Icon name="grip" size="alone" /></button
    >
  {/if}
{/snippet}

<!-- A person's row (SPEC section 36): one per person, however many places they have; it's where you are on any of them. `from` is the folder it's listed under. -->
{#snippet mark(feed: Feed)}
  {#if redesign !== "now"}
    <!-- Home redesign: every row has the same icon column. Safe leaves a person's empty; bold shows their face (only a picture the reader chose, never one fetched from their site). -->
    {#if L?.mark === "none" || L?.mark === "bare"}
    {:else if L?.mark === "glyph"}
      <span class="mark text-muted"><Icon name={feed.kind === "publication" ? "newspaper" : "person"} /></span>
    {:else if L?.mark === "initial"}
      <span class={["mark", feed.kind === "publication" && "mark-square"]}><Portrait name={plainSourceName(feed.title)} pictures={[chosenPicture([feed])].filter((each): each is string => !!each)} person={false} tiny /></span>
    {:else}
      <span class="mark" aria-hidden="true"></span>
    {/if}
  {/if}
{/snippet}

{#snippet faceItem(feed: Feed)}
            {@const place: Route = { kind: "feed", id: feed.id }}
            {@const here = !phone && (route.kind === "feed" || route.kind === "about") && (feed.places ?? [feed.id]).includes(route.id)}
            <li>
              <a href={addressFor(place)} aria-current={here ? "page" : undefined} onclick={(event) => follow(event, place)} class={["face place", here && "font-semibold"]}>
                <span class="face-picture"><Portrait name={plainSourceName(feed.title)} pictures={[chosenPicture([feed])].filter((each): each is string => !!each)} person={feed.kind !== "publication"} />{#if !unreadOff && feed.unread > 0}<span class="sidebar-dot unread-dot face-dot" aria-hidden="true"></span>{/if}</span>
                <span class="face-name"><bdi>{plainSourceName(feed.title)}</bdi>{#if !unreadOff && feed.unread > 0}<span class="sr-only">, something new</span>{/if}</span>
              </a>
            </li>
{/snippet}

{#snippet faceGrid(rows: Feed[])}
        <!-- Pinned as faces, three to a line, each with its name under it, as a phone's favourites. -->
        <ul class="faces">
          {#each rows as feed (feed.id)}
            {@render faceItem(feed)}
          {/each}
        </ul>
{/snippet}

{#snippet feedRow(feed: Feed, from: number | null, dot = false)}
  {@const place: Route = { kind: "feed", id: feed.id }}
  {@const here = !phone && (route.kind === "feed" || route.kind === "about") && (feed.places ?? [feed.id]).includes(route.id)}
  <li class="relative" data-drag={dragValue({ kind: "person", id: feed.id, from })}>
    <a
      href={addressFor(place)}
      aria-current={here ? "page" : undefined}
      onclick={(event) => follow(event, place)}
      title={feed.title}
      data-drop-person={feed.id}
      data-unread={unreadOff ? undefined : feed.unread}
      class={[
        "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-3 text-ui",
        // Indent means inside (decision 0225): a folder's people start a step in, on the names' edge;
        // people and publications in no folder start at the margin, as folders do. Found by name, all on the names' edge.
        redesign !== "now" ? (from === null || searching ? "pl-3" : "pl-10") : from === null && !searching ? "pl-3" : "pl-10",
        editing ? "pr-12" : "pr-3",
        here ? "font-semibold text-ink" : "text-ink",
      ]}
      >{@render mark(feed)}{@render name(plainSourceName(feed.title))}{#if dot && !unreadOff && feed.unread > 0}<span class="sidebar-dot unread-dot" aria-hidden="true"></span><span class="sr-only">, something new</span>{/if}{#if feed.waiting}<!-- Brought from a file, not checked yet (decision 0249): said in words, never a spinner. --><span class="shrink-0 text-meta text-muted"><span class="sr-only">,{" "}</span>checking…</span>{/if}{@render leadsOn()}</a
    >
    {@render personHandle(feed)}
  </li>
{/snippet}

<!--
  A folder's name: a link to its articles. On the folder you're in it is also
  the fold (decision 0123), so there it says whether the feeds show, for
  screen readers, as the arrow button does.
-->
{#snippet folderLink(folder: Folder, padded: boolean)}
  {@const place: Route = { kind: "folder", id: folder.id }}
  <a
    href={addressFor(place)}
    aria-current={isHere(place) ? "page" : undefined}
    aria-expanded={!phone && !searching && isHere(place) ? open.includes(folder.id) : undefined}
    onclick={(event) => {
      const plain = !phone && !searching && !event.metaKey && !event.ctrlKey && !event.shiftKey;
      const does = folderChoice(isHere(place), open.includes(folder.id), plain);
      if (does === "fold") event.preventDefault();
      if (does !== "go") toggle(folder.id);
      if (does !== "fold") follow(event, place);
    }}
    data-folder-link={folder.id}
    data-unread={unreadOff ? undefined : folderUnread(folder, feeds)}
    title={folder.name}
    class={["flex min-h-11 pointer-fine:min-h-8 min-w-0 flex-1 items-center rounded-press pr-3 text-ui", padded ? "gap-3 pl-10" : "gap-3 pl-3", isHere(place) ? "font-semibold text-ink" : "text-ink"]}
    >{#if redesign !== "now" && L?.mark !== "none" && (L?.headIcons ?? "no") === "no"}<span class={[L?.tiles && "flex w-full items-center", isHere(place) ? "text-ink" : "text-muted"]}><Icon name="folder" />{#if L?.folderFaces}<span class="tile-faces">{#each feeds.filter((feed) => feed.folders.includes(folder.id)).slice(0, 3) as feed (feed.id)}<span class="mark mark-small"><Portrait name={plainSourceName(feed.title)} pictures={[chosenPicture([feed])].filter((each): each is string => !!each)} person={false} tiny /></span>{/each}</span>{/if}</span>{/if}{@render name(folder.name)}{@render leadsOn()}</a
  >
{/snippet}

<!-- Under Publications while a person in several places is held over it: why they can't go there. -->
{#snippet refused(who: "person" | "publication")}
  {#if who === "publication" && refusal}<p role="status" class="px-5 pb-2 text-meta text-ink-2">{refusal}</p>{/if}
{/snippet}

<!-- People, then Publications: each a place to drop someone, to take them out of a folder or change which they are. -->
<!-- An empty one shows only while someone is being dragged, so there's always somewhere to drop them. -->
{#snippet looseList(who: "person" | "publication", rows: Feed[], heading: string)}
  <div data-drop-loose={who} class={["drop-area mx-2 rounded-press home-group", rows.length === 0 && "drop-empty", bold && "bold-group"]}>
    <h2 class={["sidebar-section label -mx-2", bold && "sr-only", L?.headings === "quiet" && "quiet-heading", signs && "flex items-center gap-3"]}>{#if signs}<span class="text-ink"><Icon name={who === "publication" ? "newspaper" : "person"} /></span>{/if}{heading}</h2>
    {@render refused(who)}
    {#if rows.length > 0 && L?.looseFaces}
      <div class="-mx-2">{@render faceGrid(rows)}</div>
    {:else if rows.length > 0}
      <ul class="-mx-2">
        {#each rows as feed (feed.id)}
          {@render feedRow(feed, null)}
        {/each}
      </ul>
    {:else}
      <p class="min-h-11 px-3 py-2 text-meta text-muted">Drop someone here.</p>
    {/if}
  </div>
{/snippet}

<div
  use:sidebarDrag={{ accepts, drop, refuse, ghostText }}
  class="arranging"
  data-editing={editing || undefined}
>
<!-- While a link or a file is held over nine turtles (linkDrop.svelte.ts): what letting go does. For the pointer only. -->
<p class="drop-hint drop-hint-link" aria-hidden="true">Drop to follow this site. Onto a folder to file them there.</p>
<p class="drop-hint drop-hint-file" aria-hidden="true">Drop a list of feeds (OPML) to import it.</p>
{#if searching}
  <h2 class="sr-only">Found by name</h2>
  {#if found.folders.length === 0 && found.feeds.length === 0}
    <p class="px-5 pt-4 pb-1 text-meta text-ink-2">No person or folder is called “<bdi>{search.trim()}</bdi>”.</p>
  {:else}
    <ul class="mt-4">
      {#each found.folders as folder (folder.id)}
        {@const here = isHere({ kind: "folder", id: folder.id })}
        <li class="place mx-2 flex" data-here={here || undefined} data-drop-folder={folder.id}>
          {@render folderLink(folder, true)}
        </li>
      {/each}
      {#each found.feeds as feed (feed.id)}
        {@render feedRow(feed, null)}
      {/each}
    </ul>
  {/if}
  <!-- The box at the top searches everything, as in every other app (decision 0231): under what it found by name, the same words in every article. -->
  <button
    type="button"
    onclick={() => searchArticles(search.trim())}
    class="place mx-2 mt-2 flex min-h-11 w-[calc(100%-1rem)] pointer-fine:min-h-8 items-center gap-3 pr-3 pl-3 text-left text-ui text-ink-2"
    ><span class="text-muted"><Icon name="search" /></span><span class="min-w-0 flex-1 truncate">Search articles for “<bdi>{search.trim()}</bdi>”</span></button
  >
{:else}
  {#if pinned.length > 0 || L?.pinAlways}
    <!-- Home redesign: the people the reader pinned, up to nine, never filled by the app; each with a dot while something of theirs is new. -->
    <div class={["home-group", bold && "bold-group"]}>
      <h2 class={["sidebar-section label flex items-center gap-3", bold && "sr-only", L?.headings === "quiet" && "quiet-heading"]}>{#if L?.headings !== "quiet"}<span class="text-ink"><Icon name="pin" /></span>{/if}Pinned</h2>
      {#if L?.faces}
        {@render faceGrid(pinned)}
      {:else}
      <ul>
        {#each pinned as feed (feed.id)}
          {@render feedRow(feed, null, true)}
        {:else}
          <!-- Shown with no one pinned, so pinning is found (Rohit, round five). -->
          <li class="pin-empty">Pin someone from their page, with <span class="pin-sign"><Icon name="pin" /></span> at its top.</li>
        {/each}
      </ul>
      {/if}
    </div>
  {/if}
  {#if folders.length > 0}
    <!-- Bold words in full ink (decision 0207), with Edit beside them: quiet, shown with a mouse once the pointer is on the sidebar. -->
    <div class={["sidebar-section-row", bold && "bold-edit"]}>
      <h2 class={["sidebar-section label", bold && "sr-only", L?.headings === "quiet" && "quiet-heading", (L?.headIcons ?? "no") !== "no" && "flex items-center gap-3"]}>{#if (L?.headIcons ?? "no") !== "no"}<span class="text-ink"><Icon name="folder" /></span>{/if}Folders</h2>
      {#if !L?.editTop}<button type="button" class="sidebar-edit" aria-pressed={editing} onclick={() => ((editing = !editing), (moving = undefined))}>{editing ? "Done" : "Edit"}</button>{/if}
    </div>
    <ul data-folder-list class={["relative home-group", L?.tiles && "tiles"]}>
      {#each folders as folder (folder.id)}
        {@const here = isHere({ kind: "folder", id: folder.id })}
        {@const inside = feeds.filter((feed) => feed.folders.includes(folder.id))}
        {@const shown = !L?.shut && !L?.tiles && (phone || open.includes(folder.id) || (L?.folderCards ?? "no") !== "no")}
        {@const steps = stepsFor(order, folder.id)}
        <li data-folder-item={folder.id}>
          <div class="place folder-row relative mx-2 flex" data-here={here || undefined} data-drag={dragValue({ kind: "folder", id: folder.id })} data-drop-folder={folder.id}>
            {@render folderLink(folder, false)}
            {#if editing}
              {#if steps.length > 0}
                <!-- In Edit, the folder's handle: drag it, or press it for Move up, Move down… -->
                <span data-handle class="handle absolute inset-y-0 right-0 flex w-9 pointer-coarse:w-11 items-center justify-center">
                  <MoreMenu
                    id={`move-folder-${folder.id}`}
                    label={`Move ${folder.name}`}
                    icon="grip"
                    groups={[{ label: `Move ${folder.name}`, items: steps.map((how) => ({ label: STEP_WORDS[how], onSelect: () => step(folder, how) })) }]}
                  />
                </span>
              {/if}
            {:else if !phone && !L?.shut && !L?.tiles && (L?.folderCards ?? "no") === "no"}
              <!--
                The show-or-hide arrow at the row's right end, shown when the
                pointer is on the row, the keyboard is on it, or on a touch screen, so the
                folder's name starts on the margin with nothing before it (decision 0123).
              -->
              <button
                type="button"
                aria-expanded={shown}
                aria-controls={`folder-${folder.id}`}
                aria-label={`What's in ${folder.name}`}
                title={shown ? "Hide what's in it" : "Show what's in it"}
                onclick={() => toggle(folder.id)}
                class="disclosure absolute inset-y-0 right-0 flex w-9 pointer-coarse:w-11 items-center justify-center rounded-press text-muted"
              >
                <Icon name={shown ? "chevron-down" : "chevron-right"} />
              </button>
            {/if}
          </div>
          {#if shown}
            <ul id={`folder-${folder.id}`} class={["mb-1", !phone && (L?.folderCards ?? "no") === "no" && "folder-feeds", L?.folderGrid && "faces"]}>
              {#if L?.folderGrid}
                {#each inside as feed (feed.id)}{@render faceItem(feed)}{/each}
              {:else}
              {#each inside as feed (feed.id)}
                {@render feedRow(feed, folder.id)}
              {:else}
                <li class="py-2 pr-5 pl-12 text-meta text-muted">No one in this folder yet.</li>
              {/each}
              {/if}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {@render yours?.()}
  {@render looseList("person", people, redesign === "now" ? "People" : "Not in a folder")}
  {@render looseList("publication", publications, "Publications")}
{/if}

<!--
  What arranging did, with Undo, or why it couldn't: a note at the sidebar's foot, the list's
  note in look (BRAND.md → "Messages"), which stays until it's closed or something else is done.
-->
{#if asking}
  {@const { row, kept } = asking}
  <!-- svelte-ignore a11y_no_static_element_interactions (Escape is Cancel, as in a sheet; the buttons inside are the controls) -->
  <div class="sidebar-note-band sticky bottom-0 z-10 px-2 pt-3 pb-1" onkeydown={(event) => {
      if (event.key !== "Escape" || leaving) return;
      event.stopPropagation();
      void stay(row);
    }}>
    <div class="toast border [&_.keep]:!border-0">
      <KeepOrRemove name={row.title} {kept} busy={leaving} onChoose={(removeKept) => leave(row, removeKept)} onCancel={() => stay(row)} />
    </div>
  </div>
{:else if note}
  <div class="sidebar-note-band sticky bottom-0 z-10 flex justify-center px-2 pt-3 pb-1">
    <div class="toast flex min-h-11 max-w-full items-center gap-x-2 border pr-1 pl-4 text-meta text-ink-2">
      <span role="status" class="min-w-0 py-2">{typeof note === "string" ? note : note.message}<span class="sr-only">{" "}{where}</span></span>
      {#if typeof note !== "string" && note.undo}
        <TextButton onclick={undo} class="-mr-1 px-2">Undo</TextButton>
      {/if}
      <button type="button" onclick={() => (note = undefined)} aria-label="Close the note" title="Close the note" class="btn-quiet btn-icon shrink-0"><Icon name="close" size="alone" /></button>
    </div>
  </div>
{/if}
</div>

{#if moving}
  <MoveSheet {folders} help="They leave the folders they're in." onMove={moveTo} onClose={() => (moving = undefined)} />
{/if}

<style>
  /*
    The sidebar's section names (Folders, People, Publications): the one
    label (app.css → .label; decision 0207 made it the app's), with more room
    above on a touch screen, where the rows are.
  */
  .sidebar-section {
    padding: 1.5rem 1.25rem 0.5rem;
  }
  @media (pointer: coarse) {
    .sidebar-section {
      padding-top: 2rem;
    }
  }
  /*
    A faint line down the left of an open folder's feeds, under the folder's
    name, so the feeds read as its contents at a glance (decision 0123).
  */
  .folder-feeds {
    position: relative;
  }
  .folder-feeds::before {
    content: "";
    position: absolute;
    inset-block: 0.25rem;
    left: 21px;
    border-left: 1px solid var(--line);
  }
  /* Home redesign: the line falls from the middle of the folder's icon. */
  :global(html:not([data-home="now"])) .folder-feeds::before {
    left: 28px;
  }
  /* Home redesign: the icon column, the same 16px on every row, so every name starts on one edge. */
  .mark {
    display: inline-flex;
    flex: none;
    width: 1rem;
    height: 1rem;
    align-items: center;
    justify-content: center;
  }
  @media (pointer: coarse) {
    .mark {
      width: 1.125rem;
      height: 1.125rem;
    }
  }
  /* Bold: a publication's face is a rounded square, a person's a circle. */
  .mark-square :global(.portrait) {
    border-radius: 4px;
  }
  /* Pinned, empty: one quiet line on how to pin, in the second ink. */
  .pin-empty {
    padding: 0.5rem 0.75rem;
    font-size: var(--text-meta);
    color: var(--ink-2);
    line-height: 1.4;
  }
  .pin-sign {
    display: inline-flex;
    vertical-align: -0.2em;
  }
  /* v9: headings as small quiet words, as a contents page names its parts. */
  .quiet-heading {
    font-weight: 400;
    color: var(--muted);
  }
  /* v7, v8, v10: pinned people as faces, three to a line. */
  .faces {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 0 0.5rem;
  }
  .face {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.25rem;
    min-height: 2.75rem;
    border-radius: var(--radius-press);
    text-align: center;
  }
  .face-picture {
    position: relative;
    display: inline-flex;
  }
  .face-dot {
    position: absolute;
    top: 0;
    right: 0;
    width: 10px;
    height: 10px;
    box-shadow: 0 0 0 2px var(--color-sidebar);
  }
  .face-name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-meta);
    color: var(--ink);
  }
  /* c10: a folder tile's first faces, overlapping a little, at its top right. */
  .tile-faces {
    display: inline-flex;
    margin-left: auto;
  }
  .tile-faces .mark + .mark {
    margin-left: -4px;
  }
  .tile-faces :global(.portrait) {
    box-shadow: 0 0 0 2px var(--paper);
  }
  /* v10: folders as tiles, two to a line: the icon over the name. */
  .tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 0 0.5rem;
  }
  .tiles .folder-row {
    margin: 0;
    border-radius: 12px;
    background-color: var(--paper);
  }
  .tiles .folder-row > :global(a) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    min-height: 4.5rem;
  }
  .tiles .folder-row > :global(a > span:last-child:not(.min-w-0)) {
    display: none;
  }
  .tiles .folder-row > :global(a > .min-w-0) {
    width: 100%;
    flex: none;
  }
  /* Bold: no headings; space alone parts one kind of row from the next. */
  .bold-group {
    margin-top: 1rem;
  }
  .bold-edit {
    margin-top: 1rem;
  }
  /* A pinned person's dot: Unread's own, in the same place at the row's end. */
  .sidebar-dot {
    position: static;
    background-color: var(--accent);
    flex-shrink: 0;
    width: 6px;
    height: 6px;
  }
  /* With a mouse or keyboard the arrow hides until it's wanted: made see-through rather than hidden. On a touch screen it always shows. */
  @media not (pointer: coarse) {
    .folder-row:not(:hover) .disclosure:not(:focus-visible) {
      opacity: 0;
    }
  }
  /* A touch screen's arrow, or Edit's handle, takes the row's end: the name stops short of it. On a phone (no arrow) the chevron lines up with everyone else's. */
  @media (pointer: coarse) {
    .folder-row:has(.disclosure, .handle) > :global(a) {
      padding-right: 2.75rem;
    }
  }
  .folder-row:has(.handle) > :global(a) {
    padding-right: 2.75rem;
  }

  /* Folders, and Edit at the same line's end (decision 0207). */
  .sidebar-section-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .sidebar-section-row .sidebar-section {
    flex: 1;
  }
  /*
    Edit: quiet words in the muted grey at the label's size, regular weight, so the heading leads.
    With a mouse it shows once the pointer is on the sidebar, or the keyboard reaches it; on a
    touch screen it always shows. 44px to press on a touch screen.
  */
  .sidebar-edit {
    margin-right: 0.5rem;
    padding: 0 0.75rem;
    min-height: 2rem;
    border-radius: var(--radius-press);
    font-size: var(--text-meta);
    color: var(--muted);
  }
  .sidebar-edit[aria-pressed="true"] {
    font-weight: 600;
    color: var(--ink);
  }
  @media (pointer: coarse) {
    .sidebar-edit {
      min-height: 2.75rem;
    }
  }
  @media (hover: hover) and (pointer: fine) {
    :global(#sidebar:not(:hover)) .sidebar-edit:not(:focus-visible, [aria-pressed="true"]) {
      opacity: 0;
    }
    .sidebar-edit:hover {
      color: var(--ink);
    }
  }

  /* The note at the sidebar's foot sits in a band of the sidebar's tone, so names scrolling under it end at its edge. */
  .sidebar-note-band {
    background-color: var(--color-sidebar);
  }

  /* The lists a person can be dropped on, marked as a folder is while one is held over it. */
  .drop-area {
    position: relative;
  }
  /* An empty People or Publications appears only while a person or publication is held. */
  .drop-empty {
    display: none;
  }
  :global(html:is([data-dragging="person"], [data-dragging="copy"])) .drop-empty {
    display: block;
  }
</style>
