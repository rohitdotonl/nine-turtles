<!--
  The signed-in app (SPEC sections 2 to 9, 15, 16, 18 and 19): the sidebar
  with its search, the folders and feeds and their unread counts, the item
  list and the reading area, side by side as the window's width allows, with
  adding a feed, editing feeds and folders, Settings and the `?` shortcut
  list. An article shown in the reading area counts as read. Nothing in it
  moves unless the reader moves it.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import AddFeed from "./AddFeed.svelte";
  import ArticleView from "./ArticleView.svelte";
  import CheatSheet from "./CheatSheet.svelte";
  import EditFeed from "./EditFeed.svelte";
  import EditFolder from "./EditFolder.svelte";
  import ItemList from "./ItemList.svelte";
  import Settings from "./Settings.svelte";
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
  import { startingStep, stepOf, type Screen } from "./steps";

  let { version, onSignedOut }: { version: string; onSignedOut: () => void } = $props();

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
    route.kind === "feed"
      ? { feed: route.id }
      : route.kind === "folder"
        ? { folder: route.id }
        : { view: route.kind === "view" ? route.view : "unread" },
  );

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
      if (moved) selected = undefined;
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

  function escape() {
    if (route.kind === "settings" || route.kind === "add-feed") closePage();
    else if (route.kind === "edit-feed" || route.kind === "edit-folder") edited(false);
    else if (reading || (selected && inArticle())) backToList();
    else if (phone && !panes.sidebar) stepBack("home");
  }
</script>

{#snippet listHead()}
            <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <h2 id="list-heading" tabindex="-1" bind:this={listHeading} class="min-w-0 text-large font-semibold break-words">
                {missing
                  ? route.kind === "folder" || route.kind === "edit-folder"
                    ? "Folder not found"
                    : "Feed not found"
                  : nameFor(route, placeName)}
              </h2>
              {#if currentFeed}
                <a
                  href={pathFor({ kind: "edit-feed", id: currentFeed.id })}
                  onclick={(event) => follow(event, { kind: "edit-feed", id: currentFeed!.id })}
                  class="flex min-h-11 shrink-0 items-center rounded border border-ink px-4">Edit feed</a
                >
              {:else if currentFolder}
                <a
                  href={pathFor({ kind: "edit-folder", id: currentFolder.id })}
                  onclick={(event) => follow(event, { kind: "edit-folder", id: currentFolder!.id })}
                  class="flex min-h-11 shrink-0 items-center rounded border border-ink px-4">Edit folder</a
                >
              {/if}
            </div>
{/snippet}

<!-- The whole app is the page's main content; the sidebar and areas inside are its named parts. -->
<main class="flex h-dvh">
  {#if !panes.sidebar}
    <!-- The wordmark is the page's main heading; with the sidebar hidden, screen readers still find it. -->
    <h1 class="sr-only">slowfeed</h1>
  {/if}
  <!-- On a phone there's no sidebar toggle: the feeds list is the home screen, reached with the back arrow. -->
  <div class={["fixed top-3 left-3", phone && "hidden"]}>
    <button
      type="button"
      aria-expanded={panes.sidebar}
      aria-controls="sidebar"
      onclick={toggleSidebar}
      class="flex min-h-11 items-center gap-2 rounded px-3 text-base"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="1.5" />
        <line x1="7.75" y1="3.75" x2="7.75" y2="16.25" />
      </svg>
      Sidebar
    </button>
  </div>
  <!--
    The top 4rem of every area is a band that never scrolls, so these two
    fixed buttons never sit over text. The hint is always shown on screens
    with a keyboard (DESIGN.md → "Keyboard": permanent).
  -->
  <button
    type="button"
    onclick={() => (cheatSheetOpen = true)}
    class={["keyboard-hint fixed top-3 right-4 min-h-11 px-2 text-small text-muted", phone && "hidden"]}
  >
    Press ? for shortcuts
  </button>

  <nav
    id="sidebar"
    aria-label="Sidebar"
    bind:this={sidebar}
    hidden={!panes.sidebar}
    class={["flex-col bg-sidebar", phone ? "pt-2" : "pt-16", panes.list ? "w-64 shrink-0" : "flex-1", panes.sidebar && "flex"]}
  >
    <div class="min-h-0 flex-1 overflow-y-auto pb-4">
      <div class="flex items-baseline gap-4 px-4 pb-4">
        <h1 class="mr-auto font-serif text-xlarge" tabindex="-1" bind:this={wordmark}>slowfeed</h1>
        {#if phone}
          <!-- The feeds screen's top bar (SPEC section 20): its unread numbers wait for this, as they wait for r. -->
          <button type="button" onclick={loadFeeds} class="min-h-11 rounded border border-ink px-4">Refresh</button>
        {/if}
        <a
          href="/settings"
          aria-current={route.kind === "settings" ? "page" : undefined}
          onclick={(event) => follow(event, { kind: "settings" })}
          class={[
            "flex min-h-11 items-center border-b-4 px-1",
            route.kind === "settings" ? "border-accent" : "border-transparent underline underline-offset-4",
          ]}>Settings</a
        >
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
          class="min-h-11 w-full rounded border border-ink bg-paper px-3 placeholder:text-muted"
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
              class={["flex min-h-11 items-center border-l-4 px-4", current ? "border-accent bg-tint-sidebar" : "border-transparent"]}
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
    <!-- Always at the very bottom, outside the scrolling list, so it never moves. -->
    <a
      href="/add-feed"
      aria-current={route.kind === "add-feed" ? "page" : undefined}
      onclick={(event) => follow(event, { kind: "add-feed" })}
      class={[
        "flex min-h-11 shrink-0 items-center border-l-4 px-4 py-2",
        route.kind === "add-feed" ? "border-accent bg-tint-sidebar" : "border-transparent",
      ]}>+ Add feed</a
    >
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
        />
      {:else if route.kind === "edit-feed" && currentFeed}
        {#key currentFeed.id}
          <EditFeed
            feed={currentFeed}
            {folders}
            bind:heading={listHeading}
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
            onSaved={() => edited(true)}
            onCancel={() => edited(false)}
            onDelete={() => deleteThis(currentFolder!)}
          />
        {/key}
      {:else if route.kind === "add-feed"}
        <section aria-labelledby="list-heading" class={["flex flex-1 flex-col bg-paper", phone ? "pt-2" : "pt-16"]}>
          {#if phone}
            <div class="flex px-4 pb-2">
              <button type="button" onclick={() => stepBack("home")} class="min-h-11 rounded px-2">‹ Feeds</button>
            </div>
          {/if}
          <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-10 md:px-10">
            <h2 id="list-heading" tabindex="-1" bind:this={listHeading} class="text-xlarge font-semibold">Add a feed</h2>
            <p class="mt-2 mb-6 max-w-xl">
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
            phone ? "pt-2" : "pt-16",
            panes.article ? "w-80 shrink-0 xl:w-96" : "flex-1",
            panes.list && "flex",
          ]}
        >
          {#if phone}
            <!-- The phone's top bar (SPEC section 20): back to the feeds, Refresh, and the screen's title. It never scrolls. -->
            <div class="px-6 pb-2">
              <div class="-ml-2 flex items-center justify-between gap-4 pb-2">
                <button type="button" onclick={() => stepBack("home")} class="min-h-11 rounded px-2">‹ Feeds</button>
                {#if itemList && !missing}
                  <button type="button" onclick={() => itemList?.refresh()} class="min-h-11 rounded border border-ink px-4"
                    >Refresh</button
                  >
                {/if}
              </div>
              {@render listHead()}
            </div>
          {/if}
          <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
            {#if !phone}
              {@render listHead()}
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
              <!-- Refresh and "Mark all as read", the reserved lines for "New items · press r" and "Marked … · Undo", then the list. -->
              {#key `${pathFor(route)} ${sort}`}
                <ItemList
                  bind:this={itemList}
                  bind:selected
                  {source}
                  order={sort}
                  {notice}
                  empty={emptyText(route)}
                  onChoose={chose}
                  onUnreadChange={unreadChanged}
                  onRefresh={loadFeeds}
                  refreshInTopBar={phone}
                />
              {/key}
            {/if}
          </div>
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
            <section aria-label="Article" class="flex min-w-0 flex-1 flex-col bg-paper pt-16">
              <div class="min-h-0 flex-1 overflow-y-auto px-10 pb-6">
                <p class="text-muted">No article open.</p>
              </div>
            </section>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}
</main>

<CheatSheet bind:open={cheatSheetOpen} />
