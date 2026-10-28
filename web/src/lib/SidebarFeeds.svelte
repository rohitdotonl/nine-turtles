<!--
  The sidebar's saved searches, collections, folders and feeds (SPEC section
  5). Saved searches come first, A to Z, under their own small heading, only
  once there is one; each has a small search icon in the icon column, where
  Unread, Starred and All have theirs, and no count. Collections follow the
  same way, each with a small shelf of books (SPEC section 34). Then folders A to Z, each
  with a muted unread count (its feeds' counts added up) and a button that
  shows or hides the feeds in it, then the feeds in no folder, A to Z. A
  feed in two folders is listed under both. Which folders are open is
  remembered on this device.

  As in a Mac source list (decision 0041), a folder's show-or-hide arrow
  sits before its name, so every row's count ends at the same right edge,
  one column of numbers. Every name starts at one left edge, 46px into the
  sidebar, where Unread, Starred and All start theirs; a folder's feeds
  start one step further in (decision 0043).

  On a phone the feeds screen is the root of a stack: nothing is marked as
  selected there, and every row ends in a chevron, after its count, because
  it leads on to a screen of its own. So a folder there has no arrow of its
  own (one chevron per row): its feeds are always listed under it, a step
  in, and a tap on its name opens its list (decision 0043).

  While the sidebar search holds text, a flat list of the folders and feeds
  whose name contains it takes their place (saved searches and collections aren't in it:
  the find field is for feeds and folders, DESIGN.md → Exceptions log).

  In river mode (SPEC section 10) there are no counts, nor when the reader
  hides them in Settings › Reading.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Feed, Folder } from "./shapes";
  import { findByName, folderUnread, inDevanagari, plainSourceName, saveOpenFolders, savedOpenFolders, unreadLabel } from "./feeds";
  import { pathFor, type Route } from "./router";
  import type { SavedSearch } from "./saved";
  import type { Collection } from "./collections";

  let {
    feeds,
    folders,
    searches,
    collections = [],
    route,
    search,
    follow,
    phone = false,
    river = false,
    numbers = true,
  }: {
    feeds: Feed[];
    folders: Folder[];
    /** Saved searches, alphabetically (SPEC section 14). */
    searches: SavedSearch[];
    /** The reader's collections, A to Z (SPEC section 34); none when hidden in Settings. */
    collections?: Collection[];
    route: Route;
    /** What's typed in the sidebar search. */
    search: string;
    follow: (event: MouseEvent, next: Route) => void;
    /** The phone's feeds screen: no selection, and a chevron on every row. */
    phone?: boolean;
    /** River mode: no unread counts. */
    river?: boolean;
    /** Unread counts show; the reader can hide them in Settings › Reading (decision 0097). */
    numbers?: boolean;
  } = $props();

  let open: number[] = $state(savedOpenFolders());

  /** The folders open now: Shift+J and Shift+K pass over the feeds in the others (decision 0110). */
  export function openFolders(): number[] {
    return open;
  }

  /**
   * `e`: folds or unfolds a folder, as its arrow does (decision 0103). If the
   * keyboard's place was on one of the feeds it hides, it moves to the
   * folder's own row rather than being lost.
   */
  export function toggleFolder(id: number) {
    if (phone) return;
    const inside = document.getElementById(`folder-${id}`)?.contains(document.activeElement) ?? false;
    toggle(id);
    if (inside) queueMicrotask(() => document.querySelector<HTMLElement>(`[data-folder-link="${id}"]`)?.focus());
  }

  function toggle(id: number) {
    open = open.includes(id) ? open.filter((each) => each !== id) : [...open, id];
    saveOpenFolders(open);
  }

  let searching = $derived(search.trim() !== "");
  let found = $derived(findByName({ feeds, folders }, search));
  let loose = $derived(feeds.filter((feed) => feed.folders.length === 0));

  function isHere(place: Route): boolean {
    // The phone's feeds screen shows no selection: you're at the root, not in a place.
    return !phone && pathFor(place) === pathFor(route);
  }
</script>

{#snippet count(unread: number)}
  {#if !river && numbers && unreadLabel(unread)}<span class="min-w-[2ch] shrink-0 text-right text-meta text-muted tabular-nums"
      >{unreadLabel(unread)}<span class="sr-only"> unread</span></span
    >{/if}
{/snippet}

{#snippet name(text: string)}
  <!-- Devanagari a touch larger, so it sits level with Latin names (decision 0041). -->
  <span class={["min-w-0 flex-1 truncate", inDevanagari(text) && "devanagari"]}>{text}</span>
{/snippet}

{#snippet leadsOn()}
  {#if phone}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" size={16} /></span>{/if}
{/snippet}

{#snippet feedRow(feed: Feed)}
  {@const place: Route = { kind: "feed", id: feed.id }}
  <li>
    <a
      href={pathFor(place)}
      aria-current={isHere(place) ? "page" : undefined}
      onclick={(event) => follow(event, place)}
      title={feed.title}
      class={[
        "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-3 pr-3.5 text-ui pointer-fine:text-small",
        // Every feed's name starts on the sidebar's one name edge, in a folder or not (decision 0123).
        "pl-[38px]",
        isHere(place) ? "font-semibold text-ink" : "text-ink",
      ]}
      >{@render name(plainSourceName(feed.title))}{@render count(feed.unread)}{@render leadsOn()}</a
    >
  </li>
{/snippet}

{#snippet searchRow(saved: SavedSearch)}
  {@const place: Route = { kind: "search", id: saved.id }}
  <li>
    <a
      href={pathFor(place)}
      aria-current={isHere(place) ? "page" : undefined}
      onclick={(event) => follow(event, place)}
      title={saved.name}
      class={[
        "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-2.5 pr-3.5 pl-3 text-ui pointer-fine:text-small",
        isHere(place) ? "font-semibold text-ink" : "text-ink",
      ]}
      ><span class={isHere(place) ? "text-ink" : "text-muted"}><Icon name="search" size={16} /></span
      >{@render name(saved.name)}<span class="sr-only"> (saved search)</span>{@render leadsOn()}</a
    >
  </li>
{/snippet}

{#snippet collectionRow(collection: Collection)}
  {@const place: Route = { kind: "collection", id: collection.id }}
  <li>
    <a
      href={pathFor(place)}
      aria-current={isHere(place) ? "page" : undefined}
      onclick={(event) => follow(event, place)}
      title={collection.name}
      class={[
        "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-2.5 pr-3.5 pl-3 text-ui pointer-fine:text-small",
        isHere(place) ? "font-semibold text-ink" : "text-ink",
      ]}
      ><span class={isHere(place) ? "text-ink" : "text-muted"}><Icon name="shelf" size={16} /></span
      >{@render name(collection.name)}<span class="sr-only"> (collection)</span>{@render leadsOn()}</a
    >
  </li>
{/snippet}

{#snippet folderLink(folder: Folder, padded: boolean)}
  {@const place: Route = { kind: "folder", id: folder.id }}
  <a
    href={pathFor(place)}
    aria-current={isHere(place) ? "page" : undefined}
    onclick={(event) => {
      // The whole row folds (decision 0123): choosing a closed folder opens it and lists its
      // articles; choosing the folder you're already in folds or unfolds it.
      if (!phone && !searching && isHere(place) && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        toggle(folder.id);
        return;
      }
      if (!phone && !searching && !open.includes(folder.id) && !event.metaKey && !event.ctrlKey && !event.shiftKey) toggle(folder.id);
      follow(event, place);
    }}
    data-folder-link={folder.id}
    title={folder.name}
    class={["flex min-h-11 pointer-fine:min-h-8 min-w-0 flex-1 items-center rounded-md pr-3.5 text-ui pointer-fine:text-small", padded ? "gap-3 pl-[38px]" : "gap-3 pl-3", isHere(place) ? "font-semibold text-ink" : "text-ink"]}
    >{@render name(folder.name)}<span class="folder-count flex shrink-0">{@render count(folderUnread(folder, feeds))}</span>{@render leadsOn()}</a
  >
{/snippet}

{#if searching}
  <h2 class="sr-only">Found by name</h2>
  {#if found.folders.length === 0 && found.feeds.length === 0}
    <p class="px-4 pt-4 text-small">No feed or folder has that in its name.</p>
  {:else}
    <ul class="mt-4">
      {#each found.folders as folder (folder.id)}
        {@const here = isHere({ kind: "folder", id: folder.id })}
        <li class="place mx-2 flex" data-here={here || undefined}>
          {@render folderLink(folder, true)}
        </li>
      {/each}
      {#each found.feeds as feed (feed.id)}
        {@render feedRow(feed)}
      {/each}
    </ul>
  {/if}
{:else}
  {#if searches.length > 0}
    <h2 class="sidebar-section">Saved searches</h2>
    <ul>
      {#each searches as saved (saved.id)}
        {@render searchRow(saved)}
      {/each}
    </ul>
  {/if}
  {#if collections.length > 0}
    <h2 class="sidebar-section">Collections</h2>
    <ul>
      {#each collections as collection (collection.id)}
        {@render collectionRow(collection)}
      {/each}
    </ul>
  {/if}
  {#if folders.length > 0}
    <h2 class="sidebar-section">Folders</h2>
    <ul>
      {#each folders as folder (folder.id)}
        {@const here = isHere({ kind: "folder", id: folder.id })}
        {@const inside = feeds.filter((feed) => feed.folders.includes(folder.id))}
        {@const shown = phone || open.includes(folder.id)}
        <li>
          <div class="place folder-row relative mx-2 flex" data-here={here || undefined}>
            {@render folderLink(folder, false)}
            {#if !phone}
              <!--
                The show-or-hide arrow at the row's right end, over the count, shown when the
                pointer is on the row, the keyboard is on it, or on a touch screen; the count
                steps aside while it shows, so the folder's name starts on the margin with
                nothing before it (decision 0123).
              -->
              <button
                type="button"
                aria-expanded={shown}
                aria-controls={`folder-${folder.id}`}
                aria-label={`Feeds in ${folder.name}`}
                title={shown ? "Hide feeds" : "Show feeds"}
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
                {@render feedRow(feed)}
              {:else}
                <li class="py-2 pr-5 pl-[46px] text-meta text-muted">No feeds in this folder.</li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if loose.length > 0}
    <h2 class="sidebar-section">Feeds</h2>
    <ul>
      {#each loose as feed (feed.id)}
        {@render feedRow(feed)}
      {/each}
    </ul>
  {/if}
{/if}

<style>
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
    top: 0.25rem;
    bottom: 0.25rem;
    left: 21px;
    border-left: 1px solid color-mix(in srgb, var(--ink) 14%, transparent);
  }
  /* The arrow hides until it's wanted; the count shows in its place meanwhile. */
  .disclosure {
    opacity: 0;
  }
  .folder-row:hover .disclosure,
  .disclosure:focus-visible {
    opacity: 1;
  }
  /* Made see-through rather than hidden, so screen readers still read the count in the folder's name. */
  .folder-row:hover :global(.folder-count),
  .folder-row:has(.disclosure:focus-visible) :global(.folder-count) {
    opacity: 0;
  }
  /* On a touch screen the arrow always shows, and the count steps left of it rather than under it. */
  @media (pointer: coarse) {
    .disclosure {
      opacity: 1;
    }
    .folder-row:hover :global(.folder-count),
    .folder-row:has(.disclosure:focus-visible) :global(.folder-count) {
      opacity: 1;
    }
    .folder-row > :global(a) {
      padding-right: 2.75rem;
    }
  }
</style>
