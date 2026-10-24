<!--
  The sidebar's folders and feeds (SPEC section 5): folders A to Z, each
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
  whose name contains it takes their place.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { findByName, folderUnread, inDevanagari, unreadLabel, type Feed, type Folder } from "./feeds";
  import { pathFor, type Route } from "./router";

  let {
    feeds,
    folders,
    route,
    search,
    follow,
    phone = false,
  }: {
    feeds: Feed[];
    folders: Folder[];
    route: Route;
    /** What's typed in the sidebar search. */
    search: string;
    follow: (event: MouseEvent, next: Route) => void;
    /** The phone's feeds screen: no selection, and a chevron on every row. */
    phone?: boolean;
  } = $props();

  const OPEN_KEY = "slowfeed.open-folders";

  let open: number[] = $state(loadOpen());

  function loadOpen(): number[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]");
      return Array.isArray(saved) ? saved.filter((id) => typeof id === "number") : [];
    } catch {
      return [];
    }
  }

  function toggle(id: number) {
    open = open.includes(id) ? open.filter((each) => each !== id) : [...open, id];
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open));
    } catch {
      // Not remembered on this device; the folder still opens.
    }
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
  {#if unreadLabel(unread)}<span class="min-w-[2ch] shrink-0 text-right text-meta text-muted tabular-nums"
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

{#snippet feedRow(feed: Feed, indent: boolean)}
  {@const place: Route = { kind: "feed", id: feed.id }}
  <li>
    <a
      href={pathFor(place)}
      aria-current={isHere(place) ? "page" : undefined}
      onclick={(event) => follow(event, place)}
      title={feed.title}
      class={[
        "place mx-2 flex min-h-11 pointer-fine:min-h-9 items-center gap-3 pr-3.5 text-ui",
        // Every name starts on the sidebar's one left edge; inside a folder, one step further in.
        indent ? "pl-14" : "pl-[38px]",
        isHere(place) ? "font-semibold text-ink" : "text-ink",
      ]}
      >{@render name(feed.title)}{@render count(feed.unread)}{@render leadsOn()}</a
    >
  </li>
{/snippet}

{#snippet folderLink(folder: Folder, padded: boolean)}
  {@const place: Route = { kind: "folder", id: folder.id }}
  <a
    href={pathFor(place)}
    aria-current={isHere(place) ? "page" : undefined}
    onclick={(event) => follow(event, place)}
    title={folder.name}
    class={["flex min-h-11 pointer-fine:min-h-9 min-w-0 flex-1 items-center gap-3 rounded-md pr-3.5 text-ui", padded && "pl-[38px]", isHere(place) ? "font-semibold text-ink" : "text-ink"]}
    >{@render name(folder.name)}{@render count(folderUnread(folder, feeds))}{@render leadsOn()}</a
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
        {@render feedRow(feed, false)}
      {/each}
    </ul>
  {/if}
{:else}
  {#if folders.length > 0}
    <h2 class="sidebar-section">Folders</h2>
    <ul>
      {#each folders as folder (folder.id)}
        {@const here = isHere({ kind: "folder", id: folder.id })}
        {@const inside = feeds.filter((feed) => feed.folders.includes(folder.id))}
        {@const shown = phone || open.includes(folder.id)}
        <li>
          <div class="place mx-2 flex" data-here={here || undefined}>
            {#if !phone}
            <!-- The arrow first, as a Mac source list's disclosure, in the column where Unread, Starred and All have their icons. -->
            <button
              type="button"
              aria-expanded={shown}
              aria-controls={`folder-${folder.id}`}
              aria-label={`Feeds in ${folder.name}`}
              onclick={() => toggle(folder.id)}
              class="disclosure relative flex min-h-11 pointer-fine:min-h-9 w-[38px] shrink-0 items-center justify-center rounded-md text-muted"
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
            {@render folderLink(folder, phone)}
          </div>
          {#if shown}
            <ul id={`folder-${folder.id}`}>
              {#each inside as feed (feed.id)}
                {@render feedRow(feed, true)}
              {:else}
                <li class="py-2 pr-5 pl-16 text-meta text-muted">No feeds in this folder.</li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if loose.length > 0}
    <h2 class="sidebar-section">{folders.length > 0 ? "Other feeds" : "Feeds"}</h2>
    <ul>
      {#each loose as feed (feed.id)}
        {@render feedRow(feed, false)}
      {/each}
    </ul>
  {/if}
{/if}

<style>
  /*
    The arrow is drawn in the 38px icon column so every name shares one left
    edge; on a touch screen its target reaches 6px further out, into the
    pane's margin, so a finger still gets 44px.
  */
  @media (pointer: coarse) {
    .disclosure::before {
      content: "";
      position: absolute;
      inset-block: 0;
      inset-inline: -6px 0;
    }
  }
</style>
