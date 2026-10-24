<!--
  The sidebar's folders and feeds (SPEC section 5): folders A to Z, each
  with a muted unread count (its feeds' counts added up) and a button that
  shows or hides the feeds in it, then the feeds in no folder, A to Z. A
  feed in two folders is listed under both. Which folders are open is
  remembered on this device.

  While the sidebar search holds text, a flat list of the folders and feeds
  whose name contains it takes their place.
-->
<script lang="ts">
  import { findByName, folderUnread, unreadLabel, type Feed, type Folder } from "./feeds";
  import { pathFor, type Route } from "./router";

  let {
    feeds,
    folders,
    route,
    search,
    follow,
  }: {
    feeds: Feed[];
    folders: Folder[];
    route: Route;
    /** What's typed in the sidebar search. */
    search: string;
    follow: (event: MouseEvent, next: Route) => void;
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
    return pathFor(place) === pathFor(route);
  }
</script>

{#snippet count(unread: number)}
  {#if unreadLabel(unread)}<span class="shrink-0 text-meta text-muted tabular-nums"
      >{unreadLabel(unread)}<span class="sr-only"> unread</span></span
    >{/if}
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
        "side-row flex min-h-11 pointer-fine:min-h-10 items-center gap-3 border-l-[3px] pr-5 text-ui",
        indent ? "pl-[37px]" : "pl-[17px]",
        isHere(place) ? "border-accent bg-tint-sidebar font-semibold text-ink" : "border-transparent text-ink-2",
      ]}><span class="min-w-0 flex-1 truncate">{feed.title}</span>{@render count(feed.unread)}</a
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
    class={["flex min-h-11 pointer-fine:min-h-10 min-w-0 flex-1 items-center gap-3 pr-5 text-ui", padded && "pl-[17px]", isHere(place) ? "font-semibold text-ink" : "text-ink-2"]}
    ><span class="min-w-0 flex-1 truncate">{folder.name}</span>{@render count(
      folderUnread(folder, feeds),
    )}</a
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
        <li class={["flex border-l-[3px]", here ? "border-accent bg-tint-sidebar" : "border-transparent"]}>
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
    <h2 class="sr-only">Folders</h2>
    <ul class="mt-4">
      {#each folders as folder (folder.id)}
        {@const here = isHere({ kind: "folder", id: folder.id })}
        {@const inside = feeds.filter((feed) => feed.folders.includes(folder.id))}
        {@const shown = open.includes(folder.id)}
        <li>
          <div class={["flex border-l-[3px]", here ? "border-accent bg-tint-sidebar" : "border-transparent"]}>
            {@render folderLink(folder, true)}
            <button
              type="button"
              aria-expanded={shown}
              aria-controls={`folder-${folder.id}`}
              aria-label={`Feeds in ${folder.name}`}
              onclick={() => toggle(folder.id)}
              class="-ml-3 flex min-h-11 pointer-fine:min-h-10 w-11 shrink-0 items-center justify-center text-muted"
            >
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                {#if shown}
                  <path d="M2.5 4.5 6 8l3.5-3.5" />
                {:else}
                  <path d="M4.5 2.5 8 6 4.5 9.5" />
                {/if}
              </svg>
            </button>
          </div>
          {#if shown}
            <ul id={`folder-${folder.id}`}>
              {#each inside as feed (feed.id)}
                {@render feedRow(feed, true)}
              {:else}
                <li class="py-2 pr-5 pl-[37px] text-meta text-muted">No feeds in this folder.</li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if loose.length > 0}
    <h2 class="sr-only">{folders.length > 0 ? "Feeds in no folder" : "Feeds"}</h2>
    <ul class="mt-4">
      {#each loose as feed (feed.id)}
        {@render feedRow(feed, false)}
      {/each}
    </ul>
  {/if}
{/if}
