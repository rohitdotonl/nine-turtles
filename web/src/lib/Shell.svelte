<!--
  The signed-in app (SPEC sections 2 to 9, 14 to 16, 18 and 19): the sidebar
  with its search, the folders and feeds and their unread counts, the item
  list with the search field above it (its results take the list's place
  until Escape), and the reading area, side by side as the window's width allows, with
  adding a feed, editing feeds and folders, Settings and the `?` shortcut
  list. An article shown in the reading area counts as read. Nothing in it
  moves unless the reader moves it.
-->
<script lang="ts">
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import { onMount, untrack } from "svelte";
  import AddFeed from "./AddFeed.svelte";
  import ArticleView from "./ArticleView.svelte";
  import CheatSheet from "./CheatSheet.svelte";
  import EditFeed from "./EditFeed.svelte";
  import EditFolder from "./EditFolder.svelte";
  import ItemList from "./ItemList.svelte";
  import PageHead from "./PageHead.svelte";
  import Settings from "./Settings.svelte";
  import SearchBar from "./SearchBar.svelte";
  import SidebarFeeds from "./SidebarFeeds.svelte";
  import {
    createFolder,
    deleteFolder,
    listFeeds,
    loadSort,
    refused,
    resubscribe,
    saveSort,
    unsubscribe,
    type Article,
    type Feed,
    type Folder,
    type Notice,
    type Order,
    type Source,
  } from "./feeds";
  import { createKeyReader } from "./keyboard";
  import { panesFor, widthFor, MEDIUM_REM, WIDE_REM, type SidebarChoice, type Width } from "./layout";
  import { TEXT_SIZES, apply, load, save } from "./preferences";
  import { VIEWS, VIEW_NAMES, nameFor, parse, pathFor, titleFor, type Route } from "./router";
  import { emptyQuery, isSearching, scopeFor, searchParams, searchedTerms, type Query } from "./search";
  import { startingStep, stepOf, type Screen } from "./steps";

  let { version, onSignedOut }: { version: string; onSignedOut: () => void } = $props();

  /** A small sign beside each view's name in the sidebar. */
  const VIEW_ICONS = { unread: "dot", starred: "star", all: "stack" } as const;

  const start = parse(location.pathname);
  let route: Route = $state(start);
  /** Where Escape and "Close settings" go back to: the last list you were on. */
  let lastPlace: Route = $state(isList(start) ? start : { kind: "view", view: "unread" });
  /** The feeds you follow and your folders, alphabetically; unknown until the server answers. */
  let feeds: Feed[] | undefined = $state();
  let folders: Folder[] = $state([]);
  /** What's typed in the sidebar search. */
  let search = $state("");
  /** What the next list's line says on arrival (after unsubscribing or deleting a folder). */
  let notice: Notice | undefined = $state();
  let feedsProblem = $state(false);
  /** The reader's sort order, shared across their devices; unknown until the server answers. */
  let sort: Order | undefined = $state();
  let preferences = $state(load());
  let width: Width = $state(currentWidth());
  /** Which screen this history entry shows (see steps.ts). */
  const firstStep = startingStep(history.state, currentWidth() === "narrow", location.pathname, isList(start));
  // On a phone-narrow window the sidebar is the home screen, but an address
  // that names a place opens that place.
  let sidebarChoice: SidebarChoice = $state(currentWidth() === "narrow" && firstStep.screen !== "home" ? "hidden" : "auto");
  let cheatSheetOpen = $state(false);
  /** The article chosen in the list, shown in the reading area. */
  let selected: Article | undefined = $state();
  /** On a phone-narrow window, the opened article takes the list's place. */
  let reading = $state(false);
  /** What the search field holds: chips and words (SPEC section 14). */
  let query: Query = $state(emptyQuery(start));
  /** The search whose results the list shows, or none: the place's own list. */
  let shown: Query | undefined = $state();
  let searchBar: SearchBar | undefined = $state();
  /** Where the keyboard's place was before `/`, to go back to on Escape. */
  let beforeSearch: Element | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  let panes = $derived(panesFor(width, sidebarChoice, reading));
  /** A phone-narrow window: one screen at a time, with a top bar and, while reading, a bottom toolbar. */
  let phone = $derived(width === "narrow");

  let wordmark: HTMLHeadingElement | undefined = $state();
  let listHeading: HTMLHeadingElement | undefined = $state();
  let settingsHeading: HTMLHeadingElement | undefined = $state();
  let dataHeading: HTMLHeadingElement | undefined = $state();
  let addField: HTMLInputElement | undefined = $state();
  let sidebar: HTMLElement | undefined = $state();
  let articleHeading: HTMLHeadingElement | undefined = $state();
  let itemList: ItemList | undefined = $state();

  /** Which articles the list shows here. */
  let source: Source = $derived(
    shown
      ? { search: searchParams(shown) }
      : route.kind === "feed"
      ? { feed: route.id }
      : route.kind === "folder"
        ? { folder: route.id }
        : { view: route.kind === "view" ? route.view : "unread" },
  );
  /** The list's identity: a new one is loaded when it changes. */
  let listKey = $derived(`${pathFor(route)} ${sort} ${shown ? JSON.stringify(searchParams(shown)) : ""}`);

  let currentFeed = $derived.by(() => {
    const place = route;
    return place.kind === "feed" || place.kind === "edit-feed" ? feeds?.find((feed) => feed.id === place.id) : undefined;
  });
  let currentFolder = $derived.by(() => {
    const place = route;
    return place.kind === "folder" || place.kind === "edit-folder"
      ? folders.find((folder) => folder.id === place.id)
      : undefined;
  });
  /** The feed's or folder's name, for the heading and the tab's title. */
  let placeName = $derived(currentFeed?.title ?? currentFolder?.name);
  /** A feed or folder address that names none you have. */
  let missing = $derived(
    feeds !== undefined &&
      (((route.kind === "feed" || route.kind === "edit-feed") && !currentFeed) ||
        ((route.kind === "folder" || route.kind === "edit-folder") && !currentFolder)),
  );
  /** No feeds yet: Unread and All show the add field instead (SPEC section 2). */
  let firstVisit = $derived(feeds !== undefined && feeds.length === 0);
  let headingText = $derived(
    missing
      ? route.kind === "folder" || route.kind === "edit-folder"
        ? "Folder not found"
        : "Feed not found"
      : shown
        ? "Search results"
        : nameFor(route, placeName),
  );

  function isList(place: Route): boolean {
    return place.kind === "view" || place.kind === "feed" || place.kind === "folder";
  }

  /** Counts changed on this screen since the page loaded; see `loadFeeds`. */
  let countChanges = 0;

  async function loadFeeds() {
    try {
      // If a mark (or an undo) changes a count while the feeds are on their
      // way, the answer may predate it: ask again, so it isn't overwritten.
      for (let tries = 0; tries < 3; tries++) {
        const before = countChanges;
        const loaded = await listFeeds();
        if (countChanges === before || tries === 2) {
          feeds = loaded.feeds;
          folders = loaded.folders;
          break;
        }
      }
      feedsProblem = false;
    } catch {
      feedsProblem = true;
    }
  }

  $effect(() => {
    apply(preferences);
    save(preferences);
  });

  $effect(() => {
    document.title = titleFor(route, placeName);
  });

  // An article counts as read as soon as the reading area shows it (SPEC
  // section 8). Only a newly shown article is marked, so `m` on the one
  // already showing keeps it unread until you move away and back.
  let lastShown: number | undefined;
  $effect(() => {
    const showing = panes.article ? selected : undefined;
    const id = showing?.id;
    untrack(() => {
      if (id === lastShown) return;
      lastShown = id;
      if (showing) itemList?.shown(showing);
    });
  });

  function unreadChanged(feedId: number, change: number) {
    countChanges++;
    const feed = feeds?.find((each) => each.id === feedId);
    if (feed) feed.unread = Math.max(0, feed.unread + change);
  }

  async function changeSort(next: Order) {
    const before = sort;
    sort = next;
    try {
      await saveSort(next);
    } catch {
      sort = before;
      throw new Error("not saved");
    }
  }

  function currentWidth(): Width {
    if (matchMedia(`(min-width: ${WIDE_REM}rem)`).matches) return "wide";
    if (matchMedia(`(min-width: ${MEDIUM_REM}rem)`).matches) return "medium";
    return widthFor(0);
  }

  onMount(() => {
    // "/" and unknown addresses open Unread; the address bar says so.
    history.replaceState(firstStep, "", pathFor(route));

    const queries = [WIDE_REM, MEDIUM_REM].map((rem) => matchMedia(`(min-width: ${rem}rem)`));
    const resized = () => {
      const next = currentWidth();
      if (next !== width) {
        const focusWasInside = sidebar?.contains(document.activeElement) ?? false;
        width = next;
        sidebarChoice = "auto";
        // If the sidebar just hid with the keyboard's place in it, don't lose that place.
        queueMicrotask(() => {
          if (focusWasInside && !panes.sidebar) placeFocus(route)?.focus();
        });
      }
    };
    queries.forEach((query) => query.addEventListener("change", resized));

    // The browser's Back and Forward, and on phones the system back gesture.
    const back = () => {
      const moved = location.pathname !== pathFor(route);
      route = parse(location.pathname);
      if (isList(route)) lastPlace = route;
      if (moved) {
        selected = undefined;
        resetSearch();
      }
      arrive(stepOf(history.state)?.screen ?? (isList(route) ? "list" : "page"));
    };
    addEventListener("popstate", back);

    const readKey = createKeyReader();
    const pressed = (event: KeyboardEvent) => {
      if (event.defaultPrevented || cheatSheetOpen) return;
      const action = readKey(event, event.timeStamp);
      if (!action) return;
      event.preventDefault();
      switch (action.kind) {
        case "cheat-sheet":
          cheatSheetOpen = true;
          break;
        case "toggle-sidebar":
          toggleSidebar();
          break;
        case "go":
          go({ kind: "view", view: action.view });
          break;
        case "search":
          startSearch();
          break;
        case "add-feed":
          go({ kind: "add-feed" });
          break;
        case "escape":
          escape();
          break;
        case "move":
          move(action.step);
          break;
        case "open":
          open();
          break;
        case "open-original":
          if (selected?.link && panes.article) window.open(selected.link, "_blank", "noopener,noreferrer");
          break;
        case "star":
          if (selected && isList(route)) itemList?.toggleStar();
          break;
        case "mark-unread":
          if (selected && isList(route)) itemList?.markUnread();
          break;
        case "mark-all-read":
          if (isList(route) && (panes.list || reading)) itemList?.markAllRead();
          break;
        case "undo":
          if (isList(route)) itemList?.undo();
          break;
        case "refresh":
          if (isList(route) && (panes.list || reading)) itemList?.refresh();
          break;
        case "text-size":
          if (selected && panes.article) {
            const size = preferences.textSize + action.step;
            if (size >= 0 && size < TEXT_SIZES.length) preferences.textSize = size;
          }
          break;
      }
    };
    addEventListener("keydown", pressed);

    // After signing in, the password field is gone. Move the keyboard's place
    // (and a screen reader) to the top of the new screen.
    (panes.sidebar ? wordmark : placeFocus(route))?.focus();
    loadFeeds();
    loadSort().then((order) => (sort = order));

    return () => {
      queries.forEach((query) => query.removeEventListener("change", resized));
      removeEventListener("popstate", back);
      removeEventListener("keydown", pressed);
    };
  });

  /** Where the keyboard's place goes on arriving somewhere: its heading, or the add field. */
  function placeFocus(place: Route): HTMLElement | undefined {
    // Edit pages bind their heading to `listHeading` too.
    if (place.kind === "settings") return settingsHeading;
    if (place.kind === "add-feed") return addField;
    return listHeading;
  }

  /** The screen showing now: on a phone, the feeds list is the home screen. */
  function screenNow(): Screen {
    if (phone && panes.sidebar) return "home";
    if (reading) return "article";
    return isList(route) ? "list" : "page";
  }

  /** Shows a screen the browser's history went back (or forward) to. */
  function arrive(screen: Screen) {
    reading = phone && screen === "article" && selected !== undefined;
    if (phone) sidebarChoice = screen === "home" ? "shown" : "hidden";
    queueMicrotask(() => {
      if (phone && screen === "home") wordmark?.focus();
      else if (reading) articleHeading?.focus();
      else if (selected && isList(route)) itemList?.focusSelected();
      else placeFocus(route)?.focus();
    });
  }

  /**
   * The phone's labeled back arrow, and Escape on a phone: one step back, to
   * `screen`. If that's the step before this one in the browser's history,
   * it's the same as the system's back; after arriving straight from a link
   * or a reload, it moves there in place.
   */
  function stepBack(screen: Screen) {
    if (stepOf(history.state)?.back === screen) {
      history.back();
      return;
    }
    history.replaceState({ screen }, "", location.pathname);
    arrive(screen);
  }

  /**
   * Goes to a place, and moves the keyboard's place to its heading. A list
   * arrived at with a `withNotice` shows it in its line, with Undo.
   */
  function go(next: Route, withNotice?: Notice) {
    const from = screenNow();
    const to: Screen = isList(next) ? "list" : "page";
    if (pathFor(next) !== location.pathname || from !== to) {
      history.pushState({ screen: to, back: from }, "", pathFor(next));
    }
    if (pathFor(next) !== pathFor(route)) selected = undefined;
    reading = false;
    notice = withNotice;
    route = next;
    resetSearch();
    if (isList(next)) lastPlace = next;
    // A feed or folder added elsewhere (another tab, another device) isn't in the list yet.
    if (next.kind === "feed" && !feeds?.some((feed) => feed.id === next.id)) loadFeeds();
    if (next.kind === "folder" && !folders.some((folder) => folder.id === next.id)) loadFeeds();
    // On a phone-narrow window the sidebar is the home screen; choosing a
    // place shows it instead.
    if (width === "narrow") sidebarChoice = "hidden";
    queueMicrotask(() => placeFocus(next)?.focus());
  }

  async function added(feed: Feed) {
    await loadFeeds();
    go({ kind: "feed", id: feed.id });
  }

  /** The empty state's "Import OPML": Settings, at Your data. */
  function goImport(event: MouseEvent) {
    follow(event, { kind: "settings" });
    if (event.defaultPrevented) queueMicrotask(() => dataHeading?.focus());
  }

  /** Back from an edit page, saved or not, to the feed or folder. */
  async function edited(saved: boolean) {
    if (saved) await loadFeeds();
    // On a phone the edit page is a step on from its list: go back that step.
    if (phone && stepOf(history.state)?.back === "list") history.back();
    else if (route.kind === "edit-feed") go({ kind: "feed", id: route.id });
    else if (route.kind === "edit-folder") go({ kind: "folder", id: route.id });
  }

  /** Unsubscribes, then shows Unread with "Unsubscribed from … · Undo". */
  async function unsubscribeFrom(feed: Feed): Promise<string | undefined> {
    const refusal = await unsubscribe(feed.id);
    if (refusal) return refused(refusal, "feed");
    await loadFeeds();
    go(
      { kind: "view", view: "unread" },
      {
        message: `Unsubscribed from ${feed.title}`,
        undo: async () => {
          const problem = await resubscribe(feed.id);
          if (problem) return refused(problem, "feed");
          await loadFeeds();
          return undefined;
        },
      },
    );
    return undefined;
  }

  /** Deletes a folder (never its feeds), then shows Unread with "Deleted … · Undo". */
  async function deleteThis(folder: Folder): Promise<string | undefined> {
    const inside = (feeds ?? []).filter((feed) => feed.folders.includes(folder.id)).map((feed) => feed.id);
    const refusal = await deleteFolder(folder.id);
    if (refusal) return refused(refusal, "folder");
    await loadFeeds();
    go(
      { kind: "view", view: "unread" },
      {
        message: `Deleted the folder ${folder.name}`,
        undo: async () => {
          const problem = await createFolder(folder.name, inside);
          if (problem) return refused(problem, "folder");
          await loadFeeds();
          return undefined;
        },
      },
    );
    return undefined;
  }

  function follow(event: MouseEvent, next: Route) {
    // Let the browser handle a click meant for a new tab or window.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(next);
  }

  /** Close settings, and Escape on Settings or Add a feed: on a phone, back one step to the feeds. */
  function closePage() {
    if (phone) stepBack("home");
    else go(lastPlace);
  }

  function toggleSidebar() {
    // On a phone the feeds are the home screen, one step back.
    if (phone) {
      if (!panes.sidebar) stepBack("home");
      return;
    }
    const hiding = panes.sidebar;
    const focusWasInside = sidebar?.contains(document.activeElement) ?? false;
    sidebarChoice = hiding ? "hidden" : "shown";
    if (hiding && focusWasInside) {
      queueMicrotask(() => placeFocus(route)?.focus());
    }
  }

  /** Is the keyboard's place in the reading area? */
  function inArticle(): boolean {
    return articleHeading?.closest("section")?.contains(document.activeElement) ?? false;
  }

  /**
   * j and k: the next or previous article. The keyboard's place follows: to
   * the new article if you were reading, otherwise to its row in the list.
   */
  function move(step: 1 | -1) {
    if (!itemList || (!panes.list && !reading)) return;
    const wasReading = reading || inArticle();
    if (!itemList.move(step)) return;
    showArticleArea();
    if (wasReading) queueMicrotask(() => articleHeading?.focus());
    else itemList.focusSelected();
  }

  /** Enter and o: open the selected article (the first, if none is selected yet) to read. */
  function open() {
    if (!itemList || (!panes.list && !reading)) return;
    if (!selected && !itemList.move(1)) return;
    if (phone && !reading) {
      // On a phone the article is a screen of its own, one step on.
      history.pushState({ screen: "article", back: "list" }, "", location.pathname);
      reading = true;
    }
    showArticleArea();
    queueMicrotask(() => articleHeading?.focus());
  }

  /** Choosing an article shows it, so on a medium window the sidebar makes way. */
  function showArticleArea() {
    if (width === "medium" && panes.sidebar) sidebarChoice = "hidden";
  }

  function chose(byKeyboard: boolean) {
    if (width === "narrow" || byKeyboard) open();
    else showArticleArea();
  }

  /** Back from the article to its row in the list. */
  function backToList() {
    if (reading) {
      stepBack("list");
      return;
    }
    itemList?.focusSelected();
  }

  /** What an empty list says, plainly. */
  function emptyText(place: Route): string {
    if (place.kind === "feed") return "This feed has no articles yet.";
    if (place.kind === "folder") return "No articles in this folder yet.";
    if (place.kind === "view" && place.view === "unread") return "Nothing unread.";
    if (place.kind === "view" && place.view === "starred") return "No starred articles yet.";
    return "No articles yet.";
  }

  /** Search starts afresh, limited to where you are. */
  function resetSearch() {
    clearTimeout(searchTimer);
    query = emptyQuery(route);
    shown = undefined;
  }

  /** `/`: into the search field, from wherever you are; Escape comes back here. */
  function startSearch() {
    if (!isList(route) || (phone && panes.sidebar)) go(lastPlace);
    else if (reading) backToList();
    else beforeSearch = document.activeElement;
    queueMicrotask(() => searchBar?.focus());
  }

  /** The field changed: search now, or a moment after typing stops. */
  function searchChanged(next: Query, now: boolean) {
    query = next;
    clearTimeout(searchTimer);
    const run = () => (shown = isSearching(query) ? $state.snapshot(query) : undefined);
    if (now) run();
    else searchTimer = setTimeout(run, 300);
  }

  /** Escape: search closes, the place's own list returns, and the keyboard goes back where it was. */
  function closeSearch() {
    resetSearch();
    const back = beforeSearch;
    beforeSearch = null;
    queueMicrotask(() => {
      if (back instanceof HTMLElement && back.isConnected && back !== document.body) back.focus();
      else listHeading?.focus();
    });
  }

  function escape() {
    if (route.kind === "settings" || route.kind === "add-feed") closePage();
    else if (route.kind === "edit-feed" || route.kind === "edit-folder") edited(false);
    else if (reading || (selected && inArticle())) backToList();
    else if (shown || isSearching(query) || document.activeElement?.closest("search")) closeSearch();
    else if (phone && !panes.sidebar) stepBack("home");
  }
</script>

{#snippet hint(padding: string)}
  <!-- Always shown on screens with a keyboard (DESIGN.md → "Keyboard": permanent): in the sidebar, or under the list when the sidebar is hidden. -->
  <button
    type="button"
    onclick={() => (cheatSheetOpen = true)}
    class={["keyboard-hint flex min-h-9 w-full items-center gap-1 text-left text-meta text-muted", padding]}
  >
    Press <kbd class="key">?</kbd> for shortcuts
  </button>
{/snippet}

{#snippet listHead()}
            <!-- When a long name pushes "Edit feed" onto its own line, its icon lines up with the name above. -->
            <!-- A long name wraps between words onto a second line, then ends in "…"; its whole name is its tooltip and is read in full by screen readers. -->
            <div class="flex min-h-11 items-center gap-4">
              <h2
                id="list-heading"
                tabindex="-1"
                bind:this={listHeading}
                title={headingText}
                class="line-clamp-2 min-w-0 flex-1 font-serif break-words text-heading font-bold tracking-[-0.01em]"
              >
                {headingText}
              </h2>
              {#if shown}
                <!-- Nothing beside the heading while searching. -->
              {:else if currentFeed}
                <a
                  href={pathFor({ kind: "edit-feed", id: currentFeed.id })}
                  onclick={(event) => follow(event, { kind: "edit-feed", id: currentFeed!.id })}
                  class="btn-quiet btn-small -mr-3 shrink-0"><Icon name="edit" size={16} />Edit feed</a
                >
              {:else if currentFolder}
                <a
                  href={pathFor({ kind: "edit-folder", id: currentFolder.id })}
                  onclick={(event) => follow(event, { kind: "edit-folder", id: currentFolder!.id })}
                  class="btn-quiet btn-small -mr-3 shrink-0"><Icon name="edit" size={16} />Edit folder</a
                >
              {/if}
            </div>
{/snippet}

<!--
  The whole app is the page's main content; the sidebar and areas inside are its named parts.
  It is exactly the window's height and never lets anything out: only the areas inside scroll,
  each on its own, so the page itself never moves (a hidden screen-reader line once stretched it).
  So every scrolling area here and in the screens it shows is `relative`: it holds its own hidden
  lines. A new scrolling area needs the same, and any new bar must sit inside an area, not beside it.
-->
<main class="relative flex h-dvh overflow-hidden">
  {#if !panes.sidebar}
    <!-- The wordmark is the page's main heading; with the sidebar hidden, screen readers still find it. -->
    <h1 class="sr-only">slowfeed</h1>
  {/if}
  <!--
    On a phone there's no sidebar toggle: the feeds list is the home screen, reached with the back arrow.
    Everywhere else it stays in this one place, at the start of the top line, whether or not the
    sidebar shows. Each area's top line (the wordmark, the list's title, the article's tools) never
    scrolls, so nothing passes under it.
  -->
  <div class={["fixed top-3 left-2 z-10", phone && "hidden"]}>
    <button
      type="button"
      aria-label="Sidebar"
      aria-expanded={panes.sidebar}
      aria-controls="sidebar"
      title={panes.sidebar ? "Hide the sidebar ( [ )" : "Show the sidebar ( [ )"}
      onclick={toggleSidebar}
      class="flex size-11 items-center justify-center rounded-md text-ink-2"
    >
      <Icon name="sidebar" size={20} />
    </button>
  </div>

  <nav
    id="sidebar"
    aria-label="Sidebar"
    bind:this={sidebar}
    hidden={!panes.sidebar}
    class={["flex-col bg-sidebar", phone ? "pt-2" : "pt-3", panes.list ? "w-64 shrink-0" : "min-w-0 flex-1", panes.sidebar && "flex"]}
  >
    <div class="relative min-h-0 flex-1 overflow-y-auto pb-4">
      <div class={["flex min-h-11 items-center gap-4 pr-4 pb-3", phone ? "pl-5" : "pl-14"]}>
        <h1 class="mr-auto font-serif text-heading tracking-[-0.01em]" tabindex="-1" bind:this={wordmark}>slowfeed</h1>
        {#if phone}
          <!-- The feeds screen's top bar (SPEC section 20): its unread numbers wait for this, as they wait for r. -->
          <button type="button" onclick={loadFeeds} class="btn-quiet btn-small -mr-2"><Icon name="refresh" size={16} />Refresh</button>
        {/if}
      </div>
      <!-- Always shown (DESIGN.md → Exceptions log): finds a feed or folder by name. -->
      <div class="px-4 pb-4">
        <label for="sidebar-search" class="sr-only">Find a feed or folder</label>
        <input
          id="sidebar-search"
          type="search"
          bind:value={search}
          placeholder="Find a feed or folder"
          autocomplete="off"
          onkeydown={(event) => {
            // Escape empties the search first; pressed again, it does what it does elsewhere.
            if (event.key === "Escape" && search !== "") {
              event.preventDefault();
              search = "";
            }
          }}
          class="field field-quiet w-full pointer-fine:min-h-10 pointer-fine:text-small"
        />
      </div>
      <ul>
        {#each VIEWS as view (view)}
          {@const current = route.kind === "view" && route.view === view}
          <li>
            <a
              href={pathFor({ kind: "view", view })}
              aria-current={current ? "page" : undefined}
              onclick={(event) => follow(event, { kind: "view", view })}
              class={[
                "place mx-1.5 flex min-h-11 pointer-fine:min-h-9 items-center gap-2.5 pr-3.5 pl-[14px] text-ui",
                current ? "font-semibold text-ink" : "text-ink-2",
              ]}
              ><span class={current ? "text-ink" : "text-muted"}><Icon name={VIEW_ICONS[view]} size={16} filled={view === "starred" && current} /></span
              >{VIEW_NAMES[view]}</a
            >
          </li>
        {/each}
      </ul>
      {#if feeds}
        <SidebarFeeds {feeds} {folders} {route} {search} {follow} />
      {/if}
      {#if feedsProblem}
        <p class="px-4 pt-4 text-small">Your feeds couldn't be loaded. Reload the page to try again.</p>
      {/if}
    </div>
    <!--
      Always at the very bottom, outside the scrolling list, so it never moves:
      Add feed in words, then the shortcut list and Settings as icons, the way
      a Mac app keeps its tools at the foot of the sidebar.
    -->
    <div class="flex shrink-0 items-center gap-1 border-t border-ink/10 py-1.5 pr-3">
      <a
        href="/add-feed"
        aria-current={route.kind === "add-feed" ? "page" : undefined}
        onclick={(event) => follow(event, { kind: "add-feed" })}
        class={[
          "place ml-1.5 flex min-h-11 min-w-0 flex-1 items-center gap-2 pr-3 pl-[14px] text-small",
          route.kind === "add-feed" ? "font-semibold text-ink" : "text-ink-2",
        ]}><Icon name="plus" size={16} />Add feed</a
      >
      {#if !phone}
        <button type="button" onclick={() => (cheatSheetOpen = true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" class="btn-quiet btn-icon"
          ><Icon name="keyboard" size={18} /></button
        >
      {/if}
      <a
        href="/settings"
        aria-label="Settings"
        title="Settings"
        aria-current={route.kind === "settings" ? "page" : undefined}
        onclick={(event) => follow(event, { kind: "settings" })}
        class={["btn-quiet btn-icon", route.kind === "settings" && "bg-tint-sidebar text-accent"]}><Icon name="settings" size={18} /></a
      >
    </div>
  </nav>

  {#if panes.list || panes.article}
    <div class="flex min-w-0 flex-1">
      {#if route.kind === "settings"}
        <Settings
          bind:preferences
          {sort}
          onSort={changeSort}
          bind:heading={settingsHeading}
          bind:dataHeading
          {version}
          {onSignedOut}
          onClose={closePage}
          onImported={loadFeeds}
          besideToggle={!phone && !panes.sidebar}
        />
      {:else if route.kind === "edit-feed" && currentFeed}
        {#key currentFeed.id}
          <EditFeed
            feed={currentFeed}
            {folders}
            bind:heading={listHeading}
            besideToggle={!phone && !panes.sidebar}
            onSaved={() => edited(true)}
            onCancel={() => edited(false)}
            onUnsubscribe={() => unsubscribeFrom(currentFeed!)}
          />
        {/key}
      {:else if route.kind === "edit-folder" && currentFolder}
        {#key currentFolder.id}
          <EditFolder
            folder={currentFolder}
            bind:heading={listHeading}
            besideToggle={!phone && !panes.sidebar}
            onSaved={() => edited(true)}
            onCancel={() => edited(false)}
            onDelete={() => deleteThis(currentFolder!)}
          />
        {/key}
      {:else if route.kind === "add-feed"}
        <section aria-labelledby="list-heading" class={["flex flex-1 flex-col bg-paper", phone ? "pt-2" : "pt-3"]}>
          {#if phone}
            <div class="flex px-4 pb-2">
              <button type="button" onclick={() => stepBack("home")} aria-label="Back to Feeds" class="btn-quiet gap-1 px-2"
                ><Icon name="back" size={20} />Feeds</button
              >
            </div>
          {/if}
          <PageHead title="Add a feed" bind:heading={listHeading} onClose={phone ? undefined : closePage} besideToggle={!phone && !panes.sidebar} />
          <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto px-6 pt-3 pb-10 md:px-10">
            <p class="mb-6 max-w-xl">
              Paste the address of a website you like, or of its feed. slowfeed finds the feed and lists its articles.
            </p>
            <AddFeed bind:field={addField} feeds={feeds ?? []} onAdded={added} onOpen={(id) => go({ kind: "feed", id })} />
          </div>
        </section>
      {:else}
        <section
          aria-labelledby="list-heading"
          hidden={!panes.list}
          class={[
            "flex-col bg-list",
            phone ? "pt-2" : "pt-3",
            panes.article ? "w-80 shrink-0 xl:w-96 2xl:w-[26rem]" : "flex-1",
            panes.list && "flex",
          ]}
        >
          {#if phone}
            <!-- The phone's top bar (SPEC section 20): back to the feeds, Refresh, and the screen's title. It never scrolls. -->
            <div class="px-6 pb-2">
              <div class="-ml-2 flex items-center justify-between gap-4 pb-2">
                <button type="button" onclick={() => stepBack("home")} aria-label="Back to Feeds" class="btn-quiet gap-1 px-2"
                ><Icon name="back" size={20} />Feeds</button
              >
                {#if itemList && !missing && !shown}
                  <button type="button" onclick={() => itemList?.refresh()} class="btn-quiet -mr-3"
                    ><Icon name="refresh" />Refresh</button
                  >
                {/if}
              </div>
              {@render listHead()}
            </div>
          {/if}
          {#if !phone}
            <!-- The list's top line never scrolls; with the sidebar hidden it starts after the sidebar button. -->
            <div class={["pr-6 pb-1", panes.sidebar ? "pl-6" : "pl-16"]}>
              {@render listHead()}
            </div>
          {/if}
          <div use:edge class="scroller relative min-h-0 flex-1 scroll-pb-20 overflow-y-auto px-6 pt-1 pb-6">
            {#if feeds && feeds.length > 0 && !missing}
              <SearchBar bind:this={searchBar} {query} {feeds} {folders} here={scopeFor(route)} onChange={searchChanged} />
            {/if}
            {#if missing && (route.kind === "folder" || route.kind === "edit-folder")}
              <p class="mt-4">There's no folder here. It may have been deleted or renamed.</p>
            {:else if missing}
              <p class="mt-4">You don't follow this feed. It may have been an old address.</p>
            {:else if firstVisit && !(route.kind === "view" && route.view === "starred")}
              <p class="mt-4 mb-6">Nothing to read yet. Add a website you like to begin.</p>
              <AddFeed bind:field={addField} feeds={[]} onAdded={added} onOpen={(id) => go({ kind: "feed", id })} />
              <p class="mt-4">
                <a href="/settings" onclick={goImport} class="inline-flex min-h-11 items-center underline underline-offset-4"
                  >Import OPML</a
                >
              </p>
            {:else if feeds !== undefined && sort !== undefined}
              <!-- Refresh and "Mark all as read", then the list, with "New items · press r" and Undo in a note floating at its foot. -->
              {#key listKey}
                <ItemList
                  bind:this={itemList}
                  bind:selected
                  {source}
                  order={sort}
                  {notice}
                  empty={shown ? "Nothing found." : emptyText(route)}
                  bold={shown ? searchedTerms(shown.words) : []}
                  onChoose={chose}
                  onUnreadChange={unreadChanged}
                  onRefresh={loadFeeds}
                  refreshInTopBar={phone}
                  results={shown !== undefined}
                  oneFeed={route.kind === "feed" && !shown}
                />
              {/key}
            {/if}
          </div>
          {#if !panes.sidebar && !phone}
            {@render hint("px-6 pb-1")}
          {/if}
        </section>
        {#if panes.article}
          {#if selected}
            <ArticleView
              article={selected}
              bind:heading={articleHeading}
              onStar={() => itemList?.toggleStar()}
              onMarkUnread={() => itemList?.markUnread()}
              phone={phone
                ? {
                    back: nameFor(route, placeName),
                    onBack: backToList,
                    onPrevious: () => move(-1),
                    onNext: () => move(1),
                    hasPrevious: itemList?.canMove(-1) ?? false,
                    hasNext: itemList?.canMove(1) ?? false,
                  }
                : undefined}
            />
          {:else}
            <!-- Waiting quietly in the middle of the page, a little above centre, like a blank page in a book. -->
            <section aria-label="Article" class="flex min-w-0 flex-1 flex-col items-center justify-center bg-paper px-6 pb-[12vh] text-center md:px-10">
              <div>
                <p class="text-ui text-ink-2">No article open.</p>
                <p class="keyboard-hint mt-1 text-small text-muted">Choose one from the list, or press <kbd class="key">j</kbd>.</p>
              </div>
            </section>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}
</main>

<CheatSheet bind:open={cheatSheetOpen} />
