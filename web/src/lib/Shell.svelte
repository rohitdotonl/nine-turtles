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
  import MoreMenu, { type MenuGroup } from "./MoreMenu.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
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
  import { device } from "./appearance.svelte";
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
  /** The list's pane and the sidebar button, for where the keyboard goes when the sidebar hides. */
  let listSection: HTMLElement | undefined = $state();
  let sidebarToggle: HTMLButtonElement | undefined = $state();

  /**
   * On a window wide enough for the list, adding a feed and editing a feed or
   * folder open as a sheet over the place you were, which stays in view.
   */
  let sheet = $derived(!phone && (route.kind === "add-feed" || route.kind === "edit-feed" || route.kind === "edit-folder"));
  /** Where the list and article come from: under a sheet, the place it opened over. */
  let under: Route = $derived(
    !sheet
      ? route
      : route.kind === "edit-feed"
        ? { kind: "feed", id: route.id }
        : route.kind === "edit-folder"
          ? { kind: "folder", id: route.id }
          : lastPlace,
  );
  let sheetHeading: HTMLHeadingElement | undefined = $state();
  /** What had the keyboard when a sheet opened, to give it back when the sheet closes. */
  let sheetOpener: Element | null = null;
  /** The sheet was opened with a step in the browser's history, so closing it is a step back. */
  let sheetPushed = false;

  function isSheet(place: Route): boolean {
    return !phone && (place.kind === "add-feed" || place.kind === "edit-feed" || place.kind === "edit-folder");
  }

  /** Which articles the list shows here. */
  let source: Source = $derived(
    shown
      ? { search: searchParams(shown) }
      : under.kind === "feed"
      ? { feed: under.id }
      : under.kind === "folder"
        ? { folder: under.id }
        : { view: under.kind === "view" ? under.view : "unread" },
  );
  /** The list's identity: a new one is loaded when it changes. */
  let listKey = $derived(`${pathFor(under)} ${sort} ${shown ? JSON.stringify(searchParams(shown)) : ""}`);

  let currentFeed = $derived.by(() => {
    const place = under.kind === "feed" ? under : route;
    return place.kind === "feed" || place.kind === "edit-feed" ? feeds?.find((feed) => feed.id === place.id) : undefined;
  });
  let currentFolder = $derived.by(() => {
    const place = under.kind === "folder" ? under : route;
    return place.kind === "folder" || place.kind === "edit-folder"
      ? folders.find((folder) => folder.id === place.id)
      : undefined;
  });
  /** A sheet is actually showing (an edit address for a feed or folder you don't have shows none). */
  let sheetShown = $derived(
    sheet && (route.kind === "add-feed" || (route.kind === "edit-feed" ? currentFeed !== undefined : currentFolder !== undefined)),
  );
  /** The feed's or folder's name, for the heading and the tab's title. */
  let placeName = $derived(currentFeed?.title ?? currentFolder?.name);
  /** A feed or folder address that names none you have. */
  let missing = $derived(
    feeds !== undefined &&
      (((under.kind === "feed" || under.kind === "edit-feed") && !currentFeed) ||
        ((under.kind === "folder" || under.kind === "edit-folder") && !currentFolder)),
  );
  /** No feeds yet: Unread and All show the add field instead (SPEC section 2). */
  let firstVisit = $derived(feeds !== undefined && feeds.length === 0);
  // Starred keeps its own list even with no feeds: it is where its More menu and sort live.
  let welcoming = $derived(firstVisit && !(under.kind === "view" && under.view === "starred"));
  /**
   * With a reading area beside the list, the welcome takes the list's room too: one empty state,
   * not an empty column beside it, as Apple Books shows (decision 0048).
   */
  let welcomeWide = $derived(welcoming && panes.article && !missing);
  /** On a phone with no feeds yet, the welcome is the screen's one visible heading; the list's title is only for screen readers. */
  let welcomeAlone = $derived(phone && welcoming && !missing);
  let welcomeHeading: HTMLHeadingElement | undefined = $state();
  /** How many articles the list shows, so the empty reading area offers j only when there's one to open. */
  let listCount = $state(0);
  /** The list's "28 results" while it shows search results, so the search options can repeat it where they'd cover it. */
  let listFound = $state("");
  /** The line above the add field, in the sheet and on the phone's page. */
  const ADD_INTRO = "slowfeed finds the feed on any website you like, and lists its articles.";
  let headingText = $derived(
    missing
      ? under.kind === "folder" || under.kind === "edit-folder"
        ? "Folder not found"
        : "Feed not found"
      : shown
        ? "Search results"
        : nameFor(under, placeName),
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
    // device.dark: "Match device" follows the device's own switch while slowfeed is open.
    apply(preferences, document.documentElement, device.dark);
    save(preferences);
  });

  $effect(() => {
    document.title = titleFor(route, placeName);
  });

  // Where you are is always in sight in the sidebar (SPEC section 5): when the
  // place changes, its row scrolls just far enough to show, at once, never
  // smoothly (decision 0051). Not when the feeds' counts change, so nothing
  // moves unless you move it. The phone's feeds screen marks no place.
  let sidebarPlace = $derived(!phone && panes.sidebar && feeds !== undefined ? pathFor(route) : "");
  $effect(() => {
    if (sidebarPlace === "") return;
    untrack(() => {
      const row = sidebar?.querySelector(".scroller [aria-current='page']");
      row?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });
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

  /**
   * The list's More (…) menu (SPEC section 6): Mark all as read and Refresh
   * (Refresh steps aside while searching: results have nothing new to
   * fetch), the sort order, then Edit feed or Edit folder in a feed's or
   * folder's own list. Choosing Edit puts the keyboard on More first, so
   * closing the sheet gives it back there.
   */
  function listMenu(): MenuGroup[] {
    const groups: MenuGroup[] = [
      {
        items: [
          { label: "Mark all as read", shortcut: phone ? undefined : "Shift+A", onSelect: () => itemList?.markAllRead() },
          ...(shown ? [] : [{ label: "Refresh", shortcut: phone ? undefined : "r", onSelect: () => itemList?.refresh() }]),
        ],
      },
      {
        label: "Sort order",
        items: [
          { label: "Newest first", checked: sort === "newest", onSelect: () => sortFromMenu("newest") },
          { label: "Oldest first", checked: sort === "oldest", onSelect: () => sortFromMenu("oldest") },
        ],
      },
    ];
    if (shown) return groups;
    const feed = currentFeed;
    const folder = currentFolder;
    if (feed) groups.push({ items: [{ label: "Edit feed…", onSelect: () => go({ kind: "edit-feed", id: feed.id }) }] });
    else if (folder) groups.push({ items: [{ label: "Edit folder…", onSelect: () => go({ kind: "edit-folder", id: folder.id }) }] });
    return groups;
  }

  /** The sort order, chosen from the list's More menu: the same setting as in Settings › Reading. */
  async function sortFromMenu(next: Order) {
    if (next === sort) return;
    try {
      await changeSort(next);
    } catch {
      itemList?.say("The sort order couldn't be saved. Try again in a moment.");
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
          if (focusWasInside && !panes.sidebar) afterSidebarHid();
        });
      }
    };
    queries.forEach((query) => query.addEventListener("change", resized));

    // The browser's Back and Forward, and on phones the system back gesture.
    const back = () => {
      const next = parse(location.pathname);
      const moved = !keepsArticle(route, next);
      const [opening, closing] = [isSheet(next) && !isSheet(route), isSheet(route) && !isSheet(next)];
      if (opening) [sheetOpener, sheetPushed] = [document.activeElement, false];
      route = next;
      if (isList(route)) lastPlace = route;
      if (moved) {
        selected = undefined;
        resetSearch();
      }
      if (closing && giveBack()) return;
      arrive(stepOf(history.state)?.screen ?? (isList(route) ? "list" : "page"));
    };
    addEventListener("popstate", back);

    const readKey = createKeyReader();
    const pressed = (event: KeyboardEvent) => {
      // A sheet keeps the keyboard to itself; its Escape is the dialog's own.
      if (event.defaultPrevented || cheatSheetOpen || sheetShown) return;
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
    if (sheetShown) return sheetHeading;
    if (welcomeWide || welcomeAlone) return welcomeHeading;
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
  /** Opening a sheet over a place, or closing it back to that place, leaves its article open. */
  function keepsArticle(from: Route, to: Route): boolean {
    if (pathFor(from) === pathFor(to)) return true;
    if (phone) return false;
    const over = (place: Route) => place.kind === "add-feed" || place.kind === "edit-feed" || place.kind === "edit-folder";
    return (over(to) && !over(from)) || (over(from) && pathFor(to) === pathFor(under));
  }

  /** After a sheet closes: the keyboard goes back to what opened it, if that's still there. */
  function giveBack(): boolean {
    const opener = sheetOpener;
    sheetOpener = null;
    if (!(opener instanceof HTMLElement) || !opener.isConnected || opener === document.body) return false;
    queueMicrotask(() => opener.focus());
    return true;
  }

  /** Closes a sheet: a step back if it opened with one, so Back doesn't reopen it. */
  function closeSheet() {
    if (sheetPushed && stepOf(history.state)?.back === "list") history.back();
    else go(under);
  }

  function go(next: Route, withNotice?: Notice) {
    const from = screenNow();
    const to: Screen = isList(next) ? "list" : "page";
    const [opening, closing] = [isSheet(next) && !isSheet(route), isSheet(route) && !isSheet(next)];
    let pushed = false;
    if (pathFor(next) !== location.pathname || from !== to) {
      history.pushState({ screen: to, back: from }, "", pathFor(next));
      pushed = true;
    }
    if (opening) [sheetOpener, sheetPushed] = [document.activeElement, pushed];
    // Opening a sheet over a place, or closing it back there, keeps that place as it was: its article and its search.
    const sameScreen = keepsArticle(route, next) && pathFor(route) !== pathFor(next);
    if (!keepsArticle(route, next)) selected = undefined;
    reading = false;
    notice = withNotice;
    route = next;
    if (!sameScreen) resetSearch();
    if (isList(next)) lastPlace = next;
    // A feed or folder added elsewhere (another tab, another device) isn't in the list yet.
    if (next.kind === "feed" && !feeds?.some((feed) => feed.id === next.id)) loadFeeds();
    if (next.kind === "folder" && !folders.some((folder) => folder.id === next.id)) loadFeeds();
    // On a phone-narrow window the sidebar is the home screen; choosing a
    // place shows it instead.
    if (width === "narrow") sidebarChoice = "hidden";
    if (closing && sameScreen && giveBack()) return;
    sheetOpener = closing ? null : sheetOpener;
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
    else if (sheetShown) closeSheet();
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
    else if (sheetShown) closeSheet();
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
      queueMicrotask(afterSidebarHid);
    }
  }

  /**
   * The sidebar hid with the keyboard's place in it. The place moves to the
   * list itself (its selected article, or its first, the list's own Tab
   * stop), not to the list's title, which would only show a ring around
   * words (decision 0038). With no articles to land on, it goes to the
   * sidebar button that was just used, which says the sidebar is hidden.
   */
  function afterSidebarHid() {
    if (!isList(route) || sheetShown) {
      placeFocus(route)?.focus();
      return;
    }
    const row = listSection?.querySelector<HTMLElement>("li button[tabindex='0']");
    if (row) row.focus();
    else sidebarToggle?.focus();
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

{#snippet welcome(start: boolean)}
  <!--
    The welcome, before the first feed (SPEC section 2): a title in the reading serif, one
    sentence, a wide field with Add feed, and importing a list of feeds as a quiet second way in,
    all in one centred 420px column, like Apple Books' empty library: one message, one action.
    On a phone (`start`) it's left-aligned on the screen's 20px margin instead (decision 0052).
    With the Add a feed sheet open over it, the sheet has the only field.
  -->
  <div class="flex w-full max-w-[26.25rem] flex-col gap-6">
    <div class={start ? "text-left" : "text-center"}>
      <h2 id="welcome-heading" tabindex="-1" bind:this={welcomeHeading} class="font-serif text-xlarge font-semibold tracking-[-0.01em]">A quiet place to read.</h2>
      <p class="mt-3 text-ink-2">Follow the websites you like, and read what they publish here, at your own pace.</p>
    </div>
    {#if !(sheet && route.kind === "add-feed")}
      <!--
        Importing sits just under the field, centred as everything here is (on a phone, on the
        screen's margin), as the other way in (decisions 0045, 0048): a link in the text color,
        underlined as the article's note links are, with no side padding so its words line up
        with the heading's, in a 44px-tall target (decision 0055).
      -->
      <AddFeed bind:field={addField} feeds={[]} onAdded={added} onOpen={(id) => go({ kind: "feed", id })} {start}>
        {#snippet alternative()}
          <a href="/settings" onclick={goImport} class="text-link">Import an OPML file…</a>
        {/snippet}
      </AddFeed>
    {:else}
      <!--
        With the Add a feed sheet over it, the field is the sheet's (one field of that name on the page).
        The welcome keeps its exact shape under the dim, a still picture of itself that nothing can
        reach, so nothing behind the sheet moves as it opens or closes (decision 0048).
      -->
      <div inert aria-hidden="true" class="flex flex-col gap-1.5">
        <div class="flex gap-2">
          <span class="field flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap text-muted">Paste a website or feed URL</span>
          <span class="btn-primary rounded-lg">Add feed</span>
        </div>
        <div class="flex min-h-[5.8rem] flex-col items-center">
          <span class="text-link">Import an OPML file…</span>
        </div>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet listHead()}
            <!--
              The list's title is one line, as Apple Books' collection titles are (decision 0041): a long
              name ends in "…", with its whole name as its tooltip and read in full by screen readers, so
              the search field below and More beside it never move. In a pane narrower than 340px it
              steps down from 24px to 22px. Beside it, one quiet More (…) button, as Apple Books has one
              per collection (decision 0038): Mark all as read, Refresh, the sort order, and Edit feed or
              Edit folder in a feed's or folder's own list (SPEC section 6).
            -->
            <div class="flex min-h-11 min-w-0 flex-1 items-center gap-4">
              <h2
                id="list-heading"
                tabindex="-1"
                bind:this={listHeading}
                title={headingText}
                class="min-w-0 flex-1 truncate font-serif text-heading leading-[1.3] font-semibold tracking-[-0.01em] @max-[340px]:text-[1.375rem]"
              >
                {headingText}
              </h2>
              {#if itemList && !missing}
                <div class="-mr-3 flex shrink-0 items-center">
                  <MoreMenu id="list-menu" groups={listMenu()} />
                </div>
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
  <div class={["fixed top-1.5 left-2 z-10", phone && "hidden"]}>
    <button
      type="button"
      bind:this={sidebarToggle}
      aria-label="Sidebar"
      aria-expanded={panes.sidebar}
      aria-controls="sidebar"
      title={panes.sidebar ? "Hide the sidebar ( [ )" : "Show the sidebar ( [ )"}
      onclick={toggleSidebar}
      class="bar-button flex size-11 items-center justify-center rounded-md text-ink-2"
    >
      <Icon name="sidebar" size={20} />
    </button>
  </div>

  <nav
    id="sidebar"
    aria-label="Sidebar"
    bind:this={sidebar}
    hidden={!panes.sidebar}
    class={["flex-col bg-sidebar", panes.list ? "w-64 shrink-0" : "min-w-0 flex-1", panes.sidebar && "flex", !phone && "pane-edge"]}
  >
    <!--
      The sidebar's top line (decision 0043): the wordmark, on the same line as the list's title and
      the article's tools, in a band of the shared height. It never scrolls; the places below it do,
      with a faint line under it once they have.
    -->
    <div class={["pane-bar gap-4 pr-4", phone ? "pl-5" : "pl-14"]}>
        <!-- A name, not a control: never a Tab stop; the keyboard lands here only when the screen opens (decision 0041). -->
        <h1 class={["wordmark mr-auto font-serif tracking-[-0.01em]", phone ? "text-xlarge" : "text-large text-ink-2"]} tabindex="-1" bind:this={wordmark}>slowfeed</h1>
        {#if phone}
          <!--
            The feeds screen's top bar (SPEC section 20): its unread numbers wait for this, as they wait for r.
            An icon alone in a 44px target, so the large wordmark has the row to itself (decision 0041).
          -->
          <button type="button" onclick={loadFeeds} aria-label="Refresh" title="Refresh" class="btn-quiet btn-icon -mr-2.5"><Icon name="refresh" size={20} /></button>
        {/if}
    </div>
    <div use:edge class="scroller relative min-h-0 flex-1 overflow-y-auto pt-1 pb-4">
      <!--
        Always shown once there's a feed (DESIGN.md → Exceptions log): finds a feed or folder by name.
        With no feeds there's nothing to find, so the welcome has the screen to itself (decision 0041).
      -->
      {#if feeds === undefined || feeds.length > 0}
      <!-- On the rows' grid (decision 0043): its icon in the column of the places' icons, its words where their names start. -->
      <div class="relative mx-2 pb-4">
        <span class="pointer-events-none absolute top-0 left-3 flex h-(--search-height) w-4 items-center justify-center text-muted"><Icon name="search" size={14} /></span>
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
          class="search-capsule w-full pr-3 pl-[38px]"
        />
      </div>
      {/if}
      <ul>
        {#each VIEWS as view (view)}
          {@const current = !phone && route.kind === "view" && route.view === view}
          <!-- On a phone the feeds screen is the root of a stack: nothing is selected there, and each row leads on with a chevron (decision 0041). -->
          <li>
            <a
              href={pathFor({ kind: "view", view })}
              aria-current={current ? "page" : undefined}
              onclick={(event) => follow(event, { kind: "view", view })}
              class={[
                "place mx-2 flex min-h-11 pointer-fine:min-h-9 items-center gap-2.5 pr-3.5 pl-3 text-ui",
                current ? "font-semibold text-ink" : "text-ink-2",
              ]}
              ><span class={current ? "text-accent" : "text-muted"}><Icon name={VIEW_ICONS[view]} size={16} filled={view === "starred" && current} /></span
              ><span class="min-w-0 flex-1">{VIEW_NAMES[view]}</span>{#if phone}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" size={16} /></span>{/if}</a
            >
          </li>
        {/each}
      </ul>
      {#if feeds}
        <SidebarFeeds {feeds} {folders} {route} {search} {follow} {phone} />
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
      <!-- An action, not a place: it never shows the "where you are" bar. -->
      <a
        href="/add-feed"
        onclick={(event) => follow(event, { kind: "add-feed" })}
        class="btn-quiet ml-1.5 min-w-0 flex-1 justify-start gap-2.5 pl-[14px] text-small text-ink-2"><Icon name="plus" size={16} />Add feed</a
      >
      {#if !phone}
        <!-- Pressed, with the gear's fill, while the shortcut list is open, so the foot shows where you are either way (decision 0054). -->
        <button
          type="button"
          onclick={() => (cheatSheetOpen = true)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          aria-pressed={cheatSheetOpen}
          class={["btn-quiet btn-icon", cheatSheetOpen && "bg-tint-sidebar text-ink"]}><Icon name="keyboard" size={18} /></button
        >
      {/if}
      <a
        href="/settings"
        aria-label="Settings"
        title="Settings"
        aria-current={route.kind === "settings" ? "page" : undefined}
        onclick={(event) => follow(event, { kind: "settings" })}
        class={["btn-quiet btn-icon", route.kind === "settings" && "bg-tint-sidebar text-ink"]}><Icon name="settings" size={18} /></a
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
      {:else if !sheet && route.kind === "edit-feed" && currentFeed}
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
      {:else if !sheet && route.kind === "edit-folder" && currentFolder}
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
      {:else if !sheet && route.kind === "add-feed"}
        <section aria-labelledby="list-heading" class="page-sheet">
          <!--
            Only on a phone (wider windows get the sheet). The phone sheet's one build (decisions 0052,
            0055): an iOS page sheet, its grouped ground 10px below the dimmed screen's top with 12px
            top corners, the title with an X that goes back to the feeds (as Escape does), no back
            arrow and no Cancel.
          -->
          <div class="page-sheet-card">
            <PageHead title="Add a feed" bind:heading={listHeading} besideToggle={!phone && !panes.sidebar} onClose={closePage} closeLabel="Close" />
            <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
              <!-- 20px under the top line as Settings is: a line on what to paste, the field, then Add feed the full width at the screen's foot. -->
              <div class="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5">
                <p>{ADD_INTRO}</p>
                <AddFeed bind:field={addField} feeds={feeds ?? []} onAdded={added} onOpen={(id) => go({ kind: "feed", id })} page />
              </div>
            </div>
          </div>
        </section>
      {:else}
        <section
          aria-labelledby="list-heading"
          bind:this={listSection}
          hidden={!panes.list || welcomeWide}
          class={[
            // A container, so the list's title can step down a size when the pane is narrow (decision 0041).
            "list-pane @container flex-col bg-list",
            phone && "phone",
            panes.article ? "w-80 shrink-0 xl:w-96 2xl:w-[26rem]" : "min-w-0 flex-1",
            panes.list && !welcomeWide && "flex",
            // A 1px line where the list meets the reading pane, as where the sidebar meets the list (decision 0054).
            !phone && panes.article && "pane-edge",
          ]}
        >
          {#if phone}
            <!-- The phone's top bar (SPEC section 20): back to the feeds, then the screen's title with More beside it. It never scrolls. -->
            <div class="pane-bar nav-bar">
              <button type="button" onclick={() => stepBack("home")} aria-label="Back to Feeds" class="btn-quiet nav-back"
                ><Icon name="back" size={22} />Feeds</button
              >
            </div>
            <div class={welcomeAlone ? "sr-only" : "pr-[var(--list-end)] pb-2 pl-[var(--list-start)]"}>
              {@render listHead()}
            </div>
          {/if}
          {#if !phone}
            <!--
              The list's top line never scrolls; with the sidebar hidden it starts after the sidebar button.
              Its title starts 32px in, where the search field and every article title start (decision 0041).
            -->
            <div class={["pane-bar pr-[var(--list-end)]", panes.sidebar ? "pl-[var(--list-start)]" : "pl-16"]}>
              {@render listHead()}
            </div>
          {/if}
          <!-- A column, so the floating note can sit at the pane's foot even under a short list. -->
          <div use:edge class="scroller relative flex min-h-0 flex-1 scroll-pb-20 flex-col overflow-y-auto pt-2 pr-[var(--list-end)] pb-6 pl-[var(--list-start)]">
            {#if feeds && feeds.length > 0 && !missing}
              <SearchBar bind:this={searchBar} {query} {feeds} {folders} here={scopeFor(under)} found={listFound} onChange={searchChanged} />
            {/if}
            {#if missing && (under.kind === "folder" || under.kind === "edit-folder")}
              <p class="mt-4">There's no folder here. It may have been deleted or renamed.</p>
            {:else if missing}
              <p class="mt-4">You don't follow this feed. It may have been an old address.</p>
            {:else if welcoming && panes.article}
              <!-- The welcome has the reading area and owns the screen: the list beside it stays empty, saying nothing (decision 0041). -->
            {:else if welcoming}
              <!-- No reading area beside the list (a phone, or a medium window with the sidebar shown): the welcome is here. -->
              <!--
                On a phone the list's title steps aside (screen readers still hear it, as the screen's
                name), so one heading shows: the welcome's, 96px under the top line on the screen's
                margin (decision 0052). A medium window keeps it centred.
              -->
              <!-- The list's 28px dot gutter (decision 0054) is for rows: the welcome steps back out to the 20px margin. -->
              <div class={phone ? "mt-[5.5rem] ml-[calc(1.25rem-var(--list-start))] flex" : "mt-8 flex justify-center"}>{@render welcome(phone)}</div>
            {:else if feeds !== undefined && sort !== undefined}
              <!-- The list, with "New items · press r" and Undo in a note floating at its foot (More, with Refresh, sits beside the title). -->
              {#key listKey}
                <ItemList
                  bind:this={itemList}
                  bind:selected
                  {source}
                  order={sort}
                  {notice}
                  empty={shown ? "Nothing found." : emptyText(under)}
                  bold={shown ? searchedTerms(shown.words) : []}
                  onChoose={chose}
                  onUnreadChange={unreadChanged}
                  onRefresh={loadFeeds}
                  results={shown !== undefined}
                  oneFeed={under.kind === "feed" && !shown}
                  bind:count={listCount}
                  bind:found={listFound}
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
              bind:preferences
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
          {:else if welcoming && !missing}
            <!-- No feeds yet: the welcome has the reading area, where a new reader's eyes go (SPEC section 2). -->
            <section aria-labelledby="welcome-heading" class="flex min-w-0 flex-1 flex-col items-center justify-center bg-paper px-5 pb-[12vh] md:px-10">
              {@render welcome(false)}
            </section>
          {:else}
            <!--
              One quiet line in the middle of the paper, as a Mac app shows when nothing is chosen
              (decision 0053): serif, muted, never the accent, no picture. Screen readers also hear,
              when the list has something to open, how to open one.
            -->
            <section aria-label="Article" class="flex min-w-0 flex-1 flex-col items-center justify-center bg-paper px-5">
              <p class="reading-empty">No article open</p>
              {#if listCount > 0 && !missing}
                <p class="sr-only">Choose one from the list<span class="keyboard-hint">, or press j</span>.</p>
              {/if}
            </section>
          {/if}
        {/if}
      {/if}
    </div>
  {/if}
</main>

<CheatSheet bind:open={cheatSheetOpen} />

{#if sheet && route.kind === "add-feed"}
  <Sheet title="Add a feed" bind:heading={sheetHeading} onClose={closePage} initial={() => addField}>
    <p>{ADD_INTRO}</p>
    <AddFeed bind:field={addField} feeds={feeds ?? []} onAdded={added} onOpen={(id) => go({ kind: "feed", id })} onCancel={closePage} />
  </Sheet>
{:else if sheet && route.kind === "edit-feed" && currentFeed}
  {#key currentFeed.id}
    <EditFeed
      sheet
      feed={currentFeed}
      {folders}
      bind:heading={sheetHeading}
      onSaved={() => edited(true)}
      onCancel={() => edited(false)}
      onUnsubscribe={() => unsubscribeFrom(currentFeed!)}
    />
  {/key}
{:else if sheet && route.kind === "edit-folder" && currentFolder}
  {#key currentFolder.id}
    <EditFolder
      sheet
      folder={currentFolder}
      bind:heading={sheetHeading}
      onSaved={() => edited(true)}
      onCancel={() => edited(false)}
      onDelete={() => deleteThis(currentFolder!)}
    />
  {/key}
{/if}
