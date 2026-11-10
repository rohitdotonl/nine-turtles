<!--
  The sidebar's folders and feeds (SPEC section 5): folders in the reader's
  own order (decision 0207), each
  with a small dot when any of its feeds has something unread, and a button that
  shows or hides the people and publications in it, then those in no
  folder, A to Z, under two headings: People, then Publications (decision
  0163). One in two folders is listed under both. Which folders are open is
  remembered on this device.

  As in a Mac source list (decision 0041), a folder's show-or-hide arrow
  sits before its name, so every row's dot sits at the same right edge,
  in one column. There are no numbers (decision 0148): a dot says something
  is new, never how much. Unread, Starred and All start their names 46px
  into the sidebar, after their icons; folders, and the people and
  publications in no folder, start at the 20px margin; a folder's feeds
  start one step in, on the 46px edge, so an indent always means "inside a
  folder" (decisions 0043, 0225).

  On a phone the feeds screen is the root of a stack: nothing is marked as
  selected there, and every row ends in a chevron, after its dot, because
  it leads on to a screen of its own. So a folder there has no arrow of its
  own (one chevron per row): its feeds are always listed under it, a step
  in, and a tap on its name opens its list (decision 0043).

  While the sidebar search holds text, a flat list of the folders and feeds
  whose name contains it takes their place.

  With Unread off (SPEC section 10) there are no dots.

  Arranging (decision 0207): a folder drags up or down, and a person or
  publication drags onto a folder, out of one, or between People and
  Publications (sidebarDrag.ts: a mouse drags at once, a finger presses and
  holds first). Edit, beside Folders, gives every row a handle for those who
  don't drag: a folder's opens Move up, Move down…, a person's "Move to a
  folder". What was done shows in a note at the sidebar's foot, with Undo.
-->
<script lang="ts">
  import { tick } from "svelte";
  import Icon from "./Icon.svelte";
  import MoreMenu from "./MoreMenu.svelte";
  import MoveSheet from "./MoveSheet.svelte";
  import TextButton from "./TextButton.svelte";
  import type { Feed, Folder } from "./shapes";
  import { findByName, folderChoice, folderUnread, inDevanagari, plainSourceName } from "./feeds";
  import { droppedBefore, placeWords, STEP_WORDS, stepped, stepsFor, type Step } from "./arranging";
  import type { LoadedLibrary, Removed } from "./library.svelte";
  import { UNDO_FAILED, UNDONE } from "./messages";
  import { pathFor, type Route } from "./router";
  import { dragValue, sidebarDrag, type Dragged, type Over } from "./sidebarDrag";

  let {
    library,
    route,
    search,
    follow,
    phone = false,
    unreadOff = false,
    searchArticles,
  }: {
    /** The reader's people and folders, and the ways to arrange them. */
    library: LoadedLibrary;
    route: Route;
    /** What's typed in the sidebar search. */
    search: string;
    follow: (event: MouseEvent, next: Route) => void;
    /** The phone's feeds screen: no selection, and a chevron on every row. */
    phone?: boolean;
    /** Unread off: no unread dots. */
    unreadOff?: boolean;
    /** Searches every article for what's typed in the sidebar search (decision 0231). */
    searchArticles: (words: string) => void;
  } = $props();

  let feeds: Feed[] = $derived(library.rows ?? []);
  let folders: Folder[] = $derived(library.folders);
  let order = $derived(folders.map((folder) => folder.id));
  /** Which folders are open: the library keeps it, so a folder Undo makes again opens as it was. */
  let open: number[] = $derived(library.openFolders);
  /** Edit: every row has a handle, for moving without dragging. */
  let editing = $state(false);
  /** Someone whose handle opened "Move to a folder". */
  let moving: Feed | undefined = $state();
  /** What the last arranging did (with Undo), or a sentence saying why it didn't. */
  let note: Removed | undefined = $state();
  /** Said only to screen readers with the note: where a moved folder is now ("Friends is 2 of 5."). */
  let where = $state("");
  /** Why the person held over Publications can't go there, under its heading. */
  let refusal = $state("");

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
    if (over.kind === "folder") return !row.folders.includes(over.id);
    if (over.who === "publication" && several(row)) return false;
    return dragged.from !== null || over.who !== (row.kind ?? "person");
  }

  /** Held over Publications, someone in several places is told why they can't go there; let go anyway, the note says it too. */
  function refuse(dragged: Dragged, over: Over, dropped = false) {
    const row = dragged.kind === "person" ? rowNamed(dragged.id) : undefined;
    const why = row && over?.kind === "loose" && over.who === "publication" && several(row) ? `${row.title} writes in more than one place, so stays under People.` : "";
    refusal = dropped ? "" : why;
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
    } else if (over.kind === "loose") {
      // Out of a folder onto People or Publications: out of it, and the one dropped on.
      await arranged(from ? library.file(row, from, null, false, over.who) : library.makeKind(row, over.who));
    }
  }

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
  let people = $derived(loose.filter((feed) => feed.kind !== "publication"));
  let publications = $derived(loose.filter((feed) => feed.kind === "publication"));

  function isHere(place: Route): boolean {
    // The phone's feeds screen shows no selection: you're at the root, not in a place.
    return !phone && pathFor(place) === pathFor(route);
  }
</script>

<!--
  Something unread here: the list's own unread dot, a step smaller to suit the
  sidebar's names, at the row's end. No number is shown (decision 0148); the
  row keeps it only as `data-unread`, unseen and unheard, for the tests.
  Screen readers hear "unread" after the name, never a number.
-->
{#snippet dot(unread: number)}
  {#if !unreadOff && unread > 0}<span aria-hidden="true" class="unread-dot sidebar-dot"></span>{/if}
{/snippet}

<!-- "unread" sits inside the name, so screen readers hear "Alpha unread", never a number. -->
{#snippet name(text: string, unread = 0)}
  <!-- Devanagari a touch larger, so it sits level with Latin names (decision 0041). -->
  <span class={["min-w-0 flex-1 truncate", inDevanagari(text) && "devanagari"]}
    ><bdi>{text}</bdi>{#if !unreadOff && unread > 0}<span class="sr-only"> unread</span>{/if}</span
  >
{/snippet}

{#snippet leadsOn()}
  {#if phone && !editing}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" size={18} /></span>{/if}
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
      class="handle btn-quiet absolute inset-y-0 right-2 flex w-9 pointer-coarse:w-11 items-center justify-center rounded-md text-muted"
      ><Icon name="grip" size={phone ? 22 : 18} /></button
    >
  {/if}
{/snippet}

<!-- A person's row (SPEC section 36): one per person, however many places they have; it's where you are on any of them. `from` is the folder it's listed under. -->
{#snippet feedRow(feed: Feed, from: number | null)}
  {@const place: Route = { kind: "feed", id: feed.id }}
  {@const here = !phone && (route.kind === "feed" || route.kind === "about" || route.kind === "edit-feed" || route.kind === "edit-source") && (feed.places ?? [feed.id]).includes(route.id)}
  <li class="relative" data-drag={dragValue({ kind: "person", id: feed.id, from })}>
    <a
      href={pathFor(place)}
      aria-current={here ? "page" : undefined}
      onclick={(event) => follow(event, place)}
      title={feed.title}
      data-unread={unreadOff ? undefined : feed.unread}
      class={[
        "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-3 text-ui pointer-fine:text-small",
        // Indent means inside (decision 0225): a folder's people start a step in, on the names' edge;
        // people and publications in no folder start at the margin, as folders do. Found by name, all on the names' edge.
        from === null && !searching ? "pl-3" : "pl-[38px]",
        editing ? "pr-12" : "pr-3.5",
        here ? "font-semibold text-ink" : "text-ink",
      ]}
      >{@render name(plainSourceName(feed.title), feed.unread)}{#if !editing}{@render dot(feed.unread)}{/if}{@render leadsOn()}</a
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
    href={pathFor(place)}
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
    class={["flex min-h-11 pointer-fine:min-h-8 min-w-0 flex-1 items-center rounded-md pr-3.5 text-ui pointer-fine:text-small", padded ? "gap-3 pl-[38px]" : "gap-3 pl-3", isHere(place) ? "font-semibold text-ink" : "text-ink"]}
    >{@render name(folder.name, folderUnread(folder, feeds))}{#if !editing}<span class="folder-dot flex shrink-0">{@render dot(folderUnread(folder, feeds))}</span>{/if}{@render leadsOn()}</a
  >
{/snippet}

<!-- Under Publications while a person in several places is held over it: why they can't go there. -->
{#snippet refused(who: "person" | "publication")}
  {#if who === "publication" && refusal}<p role="status" class="px-5 pb-2 text-meta text-ink-2">{refusal}</p>{/if}
{/snippet}

<!-- People, then Publications: each a place to drop someone, to take them out of a folder or change which they are. -->
<!-- An empty one shows only while someone is being dragged, so there's always somewhere to drop them. -->
{#snippet looseList(who: "person" | "publication", rows: Feed[], heading: string)}
  <div data-drop-loose={who} class={["drop-area mx-2 rounded-lg", rows.length === 0 && "drop-empty"]}>
    <h2 class="sidebar-section -mx-2">{heading}</h2>
    {@render refused(who)}
    {#if rows.length > 0}
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
  use:sidebarDrag={{ accepts, drop, refuse }}
  class="arranging"
  data-editing={editing || undefined}
>
{#if searching}
  <h2 class="sr-only">Found by name</h2>
  {#if found.folders.length === 0 && found.feeds.length === 0}
    <p class="px-5 pt-4 pb-1 text-small text-ink-2">No person or folder is called “<bdi>{search.trim()}</bdi>”.</p>
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
    class="place mx-2 mt-2 flex min-h-11 w-[calc(100%-1rem)] pointer-fine:min-h-8 items-center gap-2.5 pr-3.5 pl-3 text-left text-ui pointer-fine:text-small text-ink-2"
    ><span class="text-muted"><Icon name="search" size={16} /></span><span class="min-w-0 flex-1 truncate">Search articles for “<bdi>{search.trim()}</bdi>”</span></button
  >
{:else}
  {#if folders.length > 0}
    <!-- Bold words in full ink (decision 0207), with Edit beside them: quiet, shown with a mouse once the pointer is on the sidebar. -->
    <div class="sidebar-section-row">
      <h2 class="sidebar-section">Folders</h2>
      <button type="button" class="sidebar-edit" aria-pressed={editing} onclick={() => ((editing = !editing), (moving = undefined))}>{editing ? "Done" : "Edit"}</button>
    </div>
    <ul data-folder-list class="relative">
      {#each folders as folder (folder.id)}
        {@const here = isHere({ kind: "folder", id: folder.id })}
        {@const inside = feeds.filter((feed) => feed.folders.includes(folder.id))}
        {@const shown = phone || open.includes(folder.id)}
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
                    size={phone ? 22 : 18}
                    groups={[{ label: `Move ${folder.name}`, items: steps.map((how) => ({ label: STEP_WORDS[how], onSelect: () => step(folder, how) })) }]}
                  />
                </span>
              {/if}
            {:else if !phone}
              <!--
                The show-or-hide arrow at the row's right end, over the dot, shown when the
                pointer is on the row, the keyboard is on it, or on a touch screen; the dot
                steps aside while it shows, so the folder's name starts on the margin with
                nothing before it (decision 0123).
              -->
              <button
                type="button"
                aria-expanded={shown}
                aria-controls={`folder-${folder.id}`}
                aria-label={`What's in ${folder.name}`}
                title={shown ? "Hide what's in it" : "Show what's in it"}
                onclick={() => toggle(folder.id)}
                class="disclosure absolute inset-y-0 right-0 flex w-9 pointer-coarse:w-11 items-center justify-center rounded-md text-muted"
              >
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  {#if shown}
                    <path d="M2.5 4.5 6 8l3.5-3.5" />
                  {:else}
                    <path d="M4.5 2.5 8 6 4.5 9.5" />
                  {/if}
                </svg>
              </button>
            {/if}
          </div>
          {#if shown}
            <ul id={`folder-${folder.id}`} class={["mb-1", !phone && "folder-feeds"]}>
              {#each inside as feed (feed.id)}
                {@render feedRow(feed, folder.id)}
              {:else}
                <li class="py-2 pr-5 pl-[46px] text-meta text-muted">No one in this folder yet.</li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {@render looseList("person", people, "People")}
  {@render looseList("publication", publications, "Publications")}
{/if}

<!--
  What arranging did, with Undo, or why it couldn't: a note at the sidebar's foot, the list's
  note in look (BRAND.md → "Messages"), which stays until it's closed or something else is done.
-->
{#if note}
  <div class="sidebar-note-band sticky bottom-0 z-10 flex justify-center px-2 pt-3 pb-1">
    <div class="toast flex min-h-11 max-w-full items-center gap-x-2 rounded-lg border pr-1 pl-4 text-small text-ink-2">
      <span role="status" class="min-w-0 py-2">{typeof note === "string" ? note : note.message}<span class="sr-only">{" "}{where}</span></span>
      {#if typeof note !== "string" && note.undo}
        <TextButton onclick={undo} class="-mr-1 px-2">Undo</TextButton>
      {/if}
      <button type="button" onclick={() => (note = undefined)} aria-label="Close the note" title="Close the note" class="btn-quiet btn-icon shrink-0"><Icon name="close" size={18} /></button>
    </div>
  </div>
{/if}
</div>

{#if moving}
  <MoveSheet {folders} help="They leave the folders they're in." onMove={moveTo} onClose={() => (moving = undefined)} />
{/if}

<style>
  /*
    The sidebar's section names (Folders, People, Publications): bold words in
    full ink (decision 0207, which replaced the small spaced capitals of
    decision 0123), larger on a touch screen, where the rows are.
  */
  .sidebar-section {
    padding: 1.5rem 1.25rem 0.5rem;
    font-size: 0.8125rem;
    line-height: 1.3;
    font-weight: 600;
    color: var(--ink);
  }
  @media (pointer: coarse) {
    .sidebar-section {
      padding-top: 1.75rem;
      font-size: 1.25rem;
    }
  }
  /*
    The sidebar's dot (decision 0148): the list's unread dot (app.css
    .unread-dot: the accent, round, CanvasText in forced colors), a step
    smaller (6px) as the sidebar's names are smaller than the list's titles,
    and in the row's flow at its end rather than in a gutter.
  */
  .sidebar-dot {
    position: static;
    flex-shrink: 0;
    width: 6px;
    height: 6px;
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
    border-left: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  }
  /*
    With a mouse or keyboard the arrow hides until it's wanted, and the dot
    shows in its place meanwhile: made see-through rather than hidden. On a touch screen the
    arrow always shows, and the dot steps left of it rather than under it.
  */
  @media not (pointer: coarse) {
    .folder-row:not(:hover) .disclosure:not(:focus-visible),
    .folder-row:is(:hover, :has(.disclosure:focus-visible)) :global(.folder-dot) {
      opacity: 0;
    }
  }
  /* A touch screen's arrow, or Edit's handle, takes the row's end: the name stops short of it. On a phone (no arrow) the dot and chevron line up with everyone else's. */
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
    Edit: quiet words in the muted grey, a step smaller than the heading, so the heading leads.
    With a mouse it shows once the pointer is on the sidebar, or the keyboard reaches it; on a
    touch screen it always shows. 44px to press on a touch screen.
  */
  .sidebar-edit {
    margin-right: 0.5rem;
    padding: 0 0.75rem;
    min-height: 2rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: var(--muted);
  }
  .sidebar-edit[aria-pressed="true"] {
    font-weight: 600;
    color: var(--ink);
  }
  @media (pointer: coarse) {
    .sidebar-edit {
      min-height: 2.75rem;
      font-size: 0.875rem;
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
