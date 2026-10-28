<!--
  The signed-in app (SPEC sections 2 to 9, 14 to 16, 18 and 19): the sidebar
  with its search, the folders and feeds and their unread counts, the item
  list with the search field above it (its results take the list's place
  until Escape), and the reading area, side by side as the window's width allows, with
  adding a feed, editing feeds and folders, Settings and the `?` shortcut
  list. An article shown in the reading area counts as read. Nothing in it
  moves unless the reader moves it. In river mode (SPEC section 10) there's
  no Unread view, no counts and no "Mark all as read"; it opens on All.
-->
<script lang="ts">
  import Logo from "./Logo.svelte";
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import PaneResizer from "./PaneResizer.svelte";
  import { onMount, tick, untrack } from "svelte";
  import AddFeed from "./AddFeed.svelte";
  import ArticleView from "./ArticleView.svelte";
  import CheatSheet from "./CheatSheet.svelte";
  import EditFeed from "./EditFeed.svelte";
  import EditFolder from "./EditFolder.svelte";
  import FailingLine from "./FailingLine.svelte";
  import EditSearch from "./EditSearch.svelte";
  import AddToCollection from "./AddToCollection.svelte";
  import RenameCollection from "./RenameCollection.svelte";
  import ItemList from "./ItemList.svelte";
  import MoreMenu, { type MenuGroup } from "./MoreMenu.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import Settings from "./Settings.svelte";
  import FeedHealth from "./FeedHealth.svelte";
  import YourFeeds from "./YourFeeds.svelte";
  import Muted from "./Muted.svelte";
  import ReadersPage from "./ReadersPage.svelte";
  import SearchBar from "./SearchBar.svelte";
  import SidebarFeeds from "./SidebarFeeds.svelte";
  import StarterFeeds from "./StarterFeeds.svelte";
  import { partlyAdded, type Starter } from "./starters";
  import type { Article, Feed, Folder, Source } from "./shapes";
  import { homeView, type Order } from "./reading";
  import { ReadingSettings } from "./settings.svelte";
  import { feedNextTo, savedOpenFolders, type Notice } from "./feeds";
  import { marksUnsaved } from "./saving";
  import { createKeyReader, keyCap, keyFor } from "./keyboard";
  import { carryOut, keyIsOurs, type KeyHands, type KeyScene } from "./shortcuts";
  import { currentKey, currentKeyOf, keys, tip } from "./keys.svelte";
  import { panesFor, widthFor, MEDIUM_REM, WIDE_REM, type SidebarChoice, type Width } from "./layout";
  import { apply, load, save } from "./preferences";
  import { device } from "./appearance.svelte";
  import { VIEWS, VIEW_NAMES, inSettings, nameFor, parentOf, parse, pathFor, titleFor, type Route, type View } from "./router";
  import { sharedAddress } from "./share";
  import { emptyQuery, isSearching, resultsTitle, scopeFor, searchParams, searchedTerms, type Query } from "./search";
  import { sameQuery, type SavedSearch } from "./saved";
  import { putBack, takenOff, type Collection, type CollectionChange } from "./collections";
  import { LoadedLibrary } from "./library.svelte";
  import { startingStep, stepOf, type Screen } from "./steps";
  import { homeFor, isList, isOver, moveTo, Opener, opensFromHere, underSheet } from "./navigation";
  import { keepUpToDate } from "./offline";
  import NowPlaying from "./NowPlaying.svelte";
  import { loadQueue, player } from "./player.svelte";
  import { whenBack } from "./connection.svelte";
  import { arrivedBySwitching, switchesOnMove, switchTo, updates, watchForNewVersions, type Carried } from "./updates.svelte";
  import { deviceText, setDeviceText } from "./device";

  let {
    version,
    owner = false,
    email = null,
    emailSending = false,
    passkeys = null,
    onSignedOut,
  }: {
    version: string;
    /** The owner sees Settings › Readers (decision 0087). */
    owner?: boolean;
    /** The email this reader signs in with, if any. */
    email?: string | null;
    /** nine turtles can send email, so the email can be changed in Settings (decision 0088). */
    emailSending?: boolean;
    /** Where passkeys work, for Settings › Passkeys (decision 0109); null when they're off. */
    passkeys?: string | null;
    onSignedOut: () => void;
  } = $props();

  /** A small sign beside each view's name in the sidebar. */
  const VIEW_ICONS = { unread: "dot", starred: "star", all: "stack", recent: "history", upnext: "queue" } as const;

  /** The reading mode, sort order, counts, when unread lets go and the hidden lists (settings.svelte.ts). */
  const settings = new ReadingSettings();
  let river = $derived(settings.mode === "river");
  /**
   * The fixed lists the sidebar shows: river mode has no Unread, and a list
   * the reader hid steps aside, except All in river mode, where it's home
   * (as Unread, which can't be hidden, is in inbox mode). Up Next shows only
   * while it holds an episode (decision 0113); once emptied it stays until
   * the reader next goes somewhere, so nothing moves up under them.
   */
  let sidebarViews: View[] = $derived(
    VIEWS.filter(
      (view) =>
        !(river && view === "unread") &&
        !((settings.hidden as string[]).includes(view) && !(river && view === "all")) &&
        !(view === "upnext" && !player.upNext?.length && !upNextStays),
    ),
  );
  /** Where the app opens: Unread in inbox mode, All in river mode. */
  let home: Route = $derived({ kind: "view", view: homeView(settings.mode) });
  const parsed = parse(location.pathname);
  // "Save search" saves the search on screen: an address alone has none, so it opens the app's home.
  const asked: Route = parsed.kind === "save-search" ? { kind: "view", view: "unread" } : parsed;
  /** The address was "/", Unread or unknown: the app's home, which depends on the mode. */
  const openedHome = asked.kind === "view" && asked.view === "unread";
  const start = homeFor(asked, untrack(() => settings.mode));
  let route: Route = $state(start);
  /** Where Escape and "Close settings" go back to: the last list you were on. */
  let lastPlace: Route = $state(isList(start) ? start : { kind: "view", view: homeView(untrack(() => settings.mode)) });
  /**
   * A page shared to nine turtles (a share menu, a Shortcuts shortcut or a bookmark opening
   * /add-feed?url=…, decision 0104): Add a feed opens with its address and looks at it. Read
   * before the address bar is tidied to plain /add-feed; used for that one opening only: Add a
   * feed hands it back (onShared) as soon as it has filled the field, and leaving the place clears it too.
   */
  let shared = $state(parsed.kind === "add-feed" ? sharedAddress(location.search) : "");
  $effect(() => {
    if (route.kind !== "add-feed") untrack(() => (shared = ""));
  });

  // Switching to river mode (here, or on another device before this one
  // heard) while on Unread moves you to All, in place: no new history step.
  $effect(() => {
    const next = homeFor(route, settings.mode);
    if (next === route) return;
    untrack(() => {
      route = next;
      if (isList(lastPlace)) lastPlace = homeFor(lastPlace, settings.mode);
      history.replaceState(history.state, "", pathFor(next));
    });
  });
  /** The feeds, folders, saved searches and collections (library.svelte.ts). A saved search opened from its address (or its Edit address) runs once it's known. */
  const library = new LoadedLibrary(() => {
    if (under.kind === "search" && !shown && currentSearch) resetSearch();
  });
  /** Feeds set to flow past in Edit feed: no count, and their rows look as in river mode (SPEC section 15). */
  let flowing = $derived(new Set((library.feeds ?? []).filter((feed) => feed.river).map((feed) => feed.id)));
  /** The article whose "Add to collection" sheet is open, and the collection being renamed (decision 0108). */
  let collecting: Article | undefined = $state();
  let renaming: Collection | undefined = $state();
  /** What had the keyboard when one of those two sheets opened, to give it back. */
  const collectionOpener = new Opener();
  /** What "Save search" or "Edit saved search" will save: the search showing when it was opened. */
  let toSave: Query | undefined = $state();
  /** What's typed in the sidebar search. */
  let search = $state("");
  /** What the next list's line says on arrival (after unsubscribing or deleting a folder). */
  let notice: Notice | undefined = $state();
  let preferences = $state(load());
  let width: Width = $state(currentWidth());
  /** Which screen this history entry shows (see steps.ts). */
  const firstStep = startingStep(history.state, currentWidth() === "narrow", location.pathname, isList(start));
  // On a phone-narrow window the sidebar is the home screen, but an address
  // that names a place opens that place.
  let sidebarChoice: SidebarChoice = $state(currentWidth() === "narrow" && firstStep.screen !== "home" ? "hidden" : "auto");
  let cheatSheetOpen = $state(false);
  /** The shortcut list opens ready to change keys: from Settings › Keyboard (decision 0110). */
  let cheatSheetEditing = $state(false);
  /** On a computer, the reader hid the article list (] or its button) to give the article its room. */
  let listHidden = $state(false);
  /** The article chosen in the list, shown in the reading area. */
  let selected: Article | undefined = $state();
  /** On a phone-narrow window, the opened article takes the list's place. */
  let reading = $state(false);
  /** What the search field holds: chips and words (SPEC section 14). */
  let query: Query = $state(emptyQuery(start));
  /** The search whose results the list shows, or none: the place's own list. */
  let shown: Query | undefined = $state();
  let searchBar: SearchBar | undefined = $state();
  /**
   * On a phone the search field waits behind a Search button beside More, so
   * the list starts right under its title (decision 0060). Once asked for,
   * it stays until you press the button again with nothing searched, press
   * Escape, or go to another place: never on its own, so nothing under your
   * finger moves.
   */
  let phoneSearch = $state(false);
  /** Where the keyboard's place was before `/`, to go back to on Escape. */
  let beforeSearch: Element | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  let panes = $derived(panesFor(width, sidebarChoice, reading, listHidden));
  /** A phone-narrow window: one screen at a time, with a top bar and, while reading, a bottom toolbar. */
  let phone = $derived(width === "narrow");

  let wordmark: HTMLHeadingElement | undefined = $state();
  let listHeading: HTMLHeadingElement | undefined = $state();
  let settingsHeading: HTMLHeadingElement | undefined = $state();
  let healthHeading: HTMLHeadingElement | undefined = $state();
  let yourFeedsHeading: HTMLHeadingElement | undefined = $state();
  /** Feed health, Your feeds, Muted articles or Readers was opened from Settings, so closing it is a step back in history. */
  let mutedHeading: HTMLHeadingElement | undefined = $state();
  let readersHeading: HTMLHeadingElement | undefined = $state();
  /** "Add a rule for this feed…" in Edit feed: Settings opens with a new rule for it. */
  let ruleForFeed: number | undefined = $state();
  let cameFromSettings = false;
  /** Back from a page opened from Settings: the row on its parent page that opened it, for the keyboard to return to (decision 0120). */
  let returnRow: string | undefined;
  let addField: HTMLInputElement | undefined = $state();
  let sidebar: HTMLElement | undefined = $state();
  let articleHeading: HTMLHeadingElement | undefined = $state();
  let itemList: ItemList | undefined = $state();
  let articleView: ArticleView | undefined = $state();
  let sidebarFeeds: SidebarFeeds | undefined = $state();
  /** The list's pane and the sidebar button, for where the keyboard goes when the sidebar hides. */
  let listSection: HTMLElement | undefined = $state();
  /** Widths the reader dragged the sidebar and the list to, on this device; undefined is the usual width. */
  let sidebarWidth: number | undefined = $state(storedWidth("nine-turtles.sidebar-width"));
  let listWidth: number | undefined = $state(storedWidth("nine-turtles.list-width"));
  /** The list is never narrower than this beside the article, so feed names and titles aren't squeezed (SPEC section 4). */
  const LIST_MIN = 280;
  /** The window's width in pixels, so the list never leaves the article less than 400px. */
  let windowWidth = $state(innerWidth);

  function storedWidth(name: string): number | undefined {
    const value = Number(deviceText(name));
    return value > 0 ? value : undefined;
  }

  /**
   * The one-time tip in the empty reading area (decision 0062): shown until
   * you first open an article, by any means, or the shortcut list, then
   * never again on this device.
   */
  const TIP_KEY = "nine-turtles.shortcut-tip-seen";
  let tipSeen = $state(readTipSeen());
  function readTipSeen(): boolean {
    return deviceText(TIP_KEY) !== null;
  }
  $effect(() => {
    if (tipSeen || (!selected && !cheatSheetOpen)) return;
    tipSeen = true;
    // Private windows may refuse; the tip shows again next visit until an article is opened.
    setDeviceText(TIP_KEY, "yes");
  });

  function storeWidth(name: string, value: number | undefined) {
    setDeviceText(name, value === undefined ? null : String(value));
  }
  let sidebarToggle: HTMLButtonElement | undefined = $state();
  let listToggle: HTMLButtonElement | undefined = $state();

  /**
   * On a window wide enough for the list, adding a feed and editing a feed, folder or
   * saved search open as a sheet over the place you were, which stays in view.
   */
  let sheet = $derived(!phone && isOver(route));
  /** Where the list and article come from: under a sheet, the place it opened over (navigation.ts). */
  let under: Route = $derived(underSheet(route, lastPlace, phone));
  let sheetHeading: HTMLHeadingElement | undefined = $state();
  /** What had the keyboard when a sheet opened, to give it back when the sheet closes. */
  const sheetOpener = new Opener();
  /** The sheet was opened with a step in the browser's history, so closing it is a step back. */
  let sheetPushed = false;

  /** Which articles the list shows here. */
  let source: Source = $derived(
    shown
      ? { search: searchParams(shown) }
      : under.kind === "feed"
      ? { feed: under.id }
      : under.kind === "folder"
        ? { folder: under.id }
        : under.kind === "collection"
          ? { collection: under.id }
          : under.kind === "search"
            ? { view: "all" }
            : { view: under.kind === "view" ? under.view : homeView(settings.mode) },
  );
  /** The list's identity: a new one is loaded when it changes. */
  let listKey = $derived(`${pathFor(under)} ${settings.sort} ${shown ? JSON.stringify(searchParams(shown)) : ""}`);

  let currentFeed = $derived.by(() => {
    const place = under.kind === "feed" ? under : route;
    return place.kind === "feed" || place.kind === "edit-feed" ? library.feeds?.find((feed) => feed.id === place.id) : undefined;
  });
  let currentFolder = $derived.by(() => {
    const place = under.kind === "folder" ? under : route;
    return place.kind === "folder" || place.kind === "edit-folder"
      ? library.folders.find((folder) => folder.id === place.id)
      : undefined;
  });
  let currentSearch = $derived.by(() => {
    const place = under.kind === "search" ? under : route;
    return place.kind === "search" || place.kind === "edit-search" ? library.searches.find((search) => search.id === place.id) : undefined;
  });
  let currentCollection = $derived(under.kind === "collection" ? library.collections.find((each) => each.id === under.id) : undefined);
  /** A sheet is actually showing (an edit address for a feed, folder or saved search you don't have shows none). */
  let sheetShown = $derived(
    sheet &&
      (route.kind === "add-feed" ||
        route.kind === "new-to-feeds" ||
        (route.kind === "save-search" && toSave !== undefined) ||
        (route.kind === "edit-search" && currentSearch !== undefined) ||
        (route.kind === "edit-feed" && currentFeed !== undefined) ||
        (route.kind === "edit-folder" && currentFolder !== undefined)),
  );
  /** The feed's, folder's or saved search's name, for the heading and the tab's title. */
  let placeName = $derived(currentFeed?.title ?? currentFolder?.name ?? currentSearch?.name ?? currentCollection?.name);
  /** On a saved search, the search field no longer holds what was saved: Escape puts it back. */
  let tweaked = $derived(route.kind === "search" && currentSearch !== undefined && !sameQuery(query, currentSearch.query));
  /** A feed or folder address that names none you have. */
  let missing = $derived(
    library.feeds !== undefined &&
      (((under.kind === "feed" || under.kind === "edit-feed") && !currentFeed) ||
        ((under.kind === "folder" || under.kind === "edit-folder") && !currentFolder) ||
        ((under.kind === "search" || under.kind === "edit-search") && library.searchesLoaded && !library.searchesFailed && !currentSearch) ||
        (under.kind === "collection" && library.collectionsLoaded && !library.collectionsFailed && !currentCollection)),
  );
  /** No feeds yet: Unread and All show the add field instead (SPEC section 2). */
  let firstVisit = $derived(library.feeds !== undefined && library.feeds.length === 0);
  // Starred keeps its own list even with no feeds: it is where its More menu and sort live.
  let welcoming = $derived(firstVisit && !(under.kind === "view" && under.view === "starred"));
  /** On a computer with the sidebar and the list both hidden, their two buttons become one, which brings both back. */
  let bothHidden = $derived(!phone && !panes.sidebar && !panes.list && isList(route) && !welcoming);
  /**
   * With a reading area beside the list, the welcome takes the list's room too: one empty state,
   * not an empty column beside it, as Apple Books shows (decision 0048).
   */
  let welcomeWide = $derived(welcoming && panes.article && !missing);
  /** On a phone with no feeds yet, the welcome is the screen's one visible heading; the list's title is only for screen readers. */
  let welcomeAlone = $derived(phone && welcoming && !missing);
  let welcomeHeading: HTMLHeadingElement | undefined = $state();
  /**
   * "New to feeds?" belongs to the first visit only (decision 0079): once anything is followed, its
   * address (Back after adding starters, a bookmark) quietly becomes the home view instead.
   */
  $effect(() => {
    if (route.kind !== "new-to-feeds" || firstVisit || library.feeds === undefined) return;
    untrack(() => {
      history.replaceState({ screen: "list" }, "", pathFor(home));
      route = home;
      lastPlace = home;
      queueMicrotask(() => placeFocus(home)?.focus());
    });
  });
  /** How many articles the list shows, so the empty reading area offers j only when there's one to open. */
  let listCount = $state(0);
  /** The list's "28 results" while it shows search results, so the search options can repeat it where they'd cover it. */
  let listFound = $state("");
  /** The line above the add field, in the sheet and on the phone's page. */
  const ADD_INTRO = "nine turtles finds the feed on any website you like, and lists its articles.";
  let headingText = $derived(
    missing
      ? under.kind === "folder" || under.kind === "edit-folder"
        ? "Folder not found"
        : under.kind === "search" || under.kind === "edit-search"
          ? "Saved search not found"
          : under.kind === "collection"
            ? "Collection not found"
            : "Feed not found"
      : shown && under.kind !== "search"
        ? resultsTitle(shown.scope, library.names)
        : nameFor(under, placeName),
  );

  /** When the copies for reading offline were last brought up to date, and how long before nine turtles in view does it again. */
  let lastKept = 0;
  const KEEP_AGAIN_AFTER = 10 * 60_000;

  function keepForOffline() {
    lastKept = Date.now();
    void keepUpToDate(settings.sort ?? "newest", settings.mode);
  }

  /** Loads the feeds and folders. */
  function loadFeeds() {
    return library.loadFeeds();
  }

  $effect(() => {
    // device.dark: "Match device" follows the device's own switch while nine turtles is open.
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
  let sidebarPlace = $derived(!phone && panes.sidebar && library.feeds !== undefined ? pathFor(route) : "");
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

  /**
   * The list's More (…) menu (SPEC section 6): Mark all as read, with an
   * article chosen Mark all above or below as read (decision 0103), in
   * Unread Catch me up, and Refresh
   * (Refresh steps aside while searching: results have nothing new to
   * fetch), the sort order, then Edit feed or Edit folder in a feed's or
   * folder's own list. Choosing Edit puts the keyboard on More first, so
   * closing the sheet gives it back there.
   */
  function listMenu(): MenuGroup[] {
    const key = (kind: Parameters<typeof keyFor>[0]) => (phone ? undefined : currentKey(kind));
    // Shift+O marks what's older: below the chosen article when newest first, above it when oldest first (decision 0103).
    // In search results, ordered by how well they match, older goes by date, so neither row shows the key.
    const olderIs = shown ? undefined : settings.sort === "oldest" ? "above" : "below";
    // Recently read is in the order opened, and what's in it was read already: only Refresh applies.
    // So is Up Next, in the reader's own order (decision 0113).
    const recent = !shown && under.kind === "view" && (under.view === "recent" || under.view === "upnext");
    if (recent) return [{ items: [{ label: "Refresh", shortcut: key("refresh"), onSelect: () => itemList?.refresh() }] }];
    const groups: MenuGroup[] = [
      {
        items: [
          ...(river ? [] : [{ label: "Mark all as read", shortcut: key("mark-all-read"), onSelect: () => itemList?.markAllRead() }]),
          // Everything on one side of the chosen article, loaded yet or not (decision 0103).
          ...(river || !selected
            ? []
            : (["above", "below"] as const).map((side) => ({
                label: `Mark all ${side} as read`,
                shortcut: olderIs === side ? key("mark-older-read") : undefined,
                onSelect: () => itemList?.markPast(side),
              }))),
          // Everything in Unread from before today, listed or not (decision 0097): only in Unread itself.
          ...(!river && !shown && under.kind === "view" && under.view === "unread"
            ? [{ label: "Catch me up", onSelect: () => itemList?.catchUp() }]
            : []),
          ...(shown ? [] : [{ label: "Refresh", shortcut: key("refresh"), onSelect: () => itemList?.refresh() }]),
        ],
      },
      {
        label: "Sort order",
        icon: "sort",
        items: [
          { label: "Newest first", checked: settings.sort === "newest", onSelect: () => sortFromMenu("newest") },
          { label: "Oldest first", checked: settings.sort === "oldest", onSelect: () => sortFromMenu("oldest") },
        ],
      },
    ];
    // On a saved search, even with everything taken out of its field, it can still be edited or deleted.
    const search = under.kind === "search" ? currentSearch : undefined;
    if (shown || search) {
      // A search can be saved, to come back to from the sidebar; a saved one renamed, changed or deleted.
      groups.push({
        items: [
          search
            ? { label: "Edit saved search…", onSelect: () => openSaving({ kind: "edit-search", id: search.id }) }
            : { label: "Save search…", onSelect: () => openSaving({ kind: "save-search" }) },
        ],
      });
      return groups;
    }
    // A collection's own list: renaming it, and deleting it (never its articles), with Undo (decision 0108).
    const collection = currentCollection;
    if (collection) {
      groups.push({
        items: [
          { label: "Rename…", onSelect: () => openRenaming(collection) },
          { label: "Delete", onSelect: () => void removeCollection(collection) },
        ],
      });
      return groups;
    }
    const feed = currentFeed;
    const folder = currentFolder;
    if (feed) groups.push({ items: [{ label: "Edit feed…", shortcut: key("edit-place"), onSelect: () => go({ kind: "edit-feed", id: feed.id }) }] });
    else if (folder) groups.push({ items: [{ label: "Edit folder…", shortcut: key("edit-place"), onSelect: () => go({ kind: "edit-folder", id: folder.id }) }] });
    return groups;
  }

  /** Opens "Save search" or "Edit saved search" with the search showing now. */
  function openSaving(next: Route) {
    toSave = $state.snapshot(shown ?? query);
    go(next);
  }

  /** The sort order, chosen from the list's More menu: the same setting as in Settings › Reading. */
  async function sortFromMenu(next: Order) {
    if (next === settings.sort) return;
    try {
      await settings.changeSort(next);
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
    // "/" and unknown addresses open Unread (All in river mode); the address bar says so.
    history.replaceState(firstStep, "", pathFor(route));

    // Arriving here by switching to a new version: the screen is as the
    // reader left it, and the keyboard's place goes to the heading, as going
    // here without the switch would have done.
    const switched = arrivedBySwitching();
    if (switched) arriveSwitched(switched);
    const stopWatching = watchForNewVersions();
    // Reading offline (SPEC section 32): the copies on this device are brought
    // up to date once the settings are known (below), when the connection
    // comes back, and when nine turtles comes back into view after a while.
    const stopWaitingForConnection = whenBack(keepForOffline);
    const lookedAgain = () => {
      if (!document.hidden && Date.now() - lastKept > KEEP_AGAIN_AFTER) keepForOffline();
    };
    document.addEventListener("visibilitychange", lookedAgain);
    addEventListener("online", keepForOffline);

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
      let next = parse(location.pathname);
      // Back to "Save search" after it was used: there's nothing to save now, so the place it was over.
      if (next.kind === "save-search" && !toSave) {
        next = lastPlace;
        history.replaceState(history.state, "", pathFor(next));
      }
      // Back or Forward onto a page opened from its parent: closing it is a step back again.
      cameFromSettings = stepOf(history.state)?.fromParent === true;
      const move = moveTo({ route, under, phone }, next);
      returnRow = move.returnRow;
      // The address has already changed: loading it opens the new version there.
      if (!move.keepsArticle && switchesOnMove(updates.ready, marksUnsaved(), false)) {
        switchTo(location.pathname, carried(next));
        return;
      }
      if (move.opening) {
        sheetOpener.remember(document.activeElement);
        sheetPushed = false;
      }
      route = next;
      if (isList(route)) lastPlace = route;
      if (!move.keepsArticle) {
        selected = undefined;
        resetSearch();
      }
      if (move.closing && sheetOpener.giveBack()) return;
      arrive(stepOf(history.state)?.screen ?? (isList(route) ? "list" : "page"));
    };
    addEventListener("popstate", back);

    // The reader's own keys, as they are at each press (decision 0110).
    const readKey = createKeyReader(() => keys.chosen);
    const pressed = (event: KeyboardEvent) => {
      // A sheet keeps the keyboard to itself; its Escape is the dialog's own
      // (Settings' rule editor is a sheet of Settings' own, so it's asked of the page).
      if (event.defaultPrevented || cheatSheetOpen || sheetShown || document.querySelector("dialog:modal")) return;
      const action = readKey(event, event.timeStamp);
      if (!action) return;
      const scene = keyScene();
      if (!keyIsOurs(action, event.key, scene)) return;
      event.preventDefault();
      carryOut(action, scene, keyHands);
    };
    addEventListener("keydown", pressed);

    // After signing in, the password field is gone. Move the keyboard's place
    // (and a screen reader) to the list's title, so screen readers start at
    // what's to read; on a phone's feeds screen, which has no list, to the wordmark.
    const opening = phone && panes.sidebar ? wordmark : placeFocus(route);
    opening?.focus();
    // The first feeds can turn the list into the welcome, which hides the list's title: the
    // keyboard follows to the welcome's, unless the reader has already moved it.
    library.loadFeeds(() => {
      void tick().then(() => {
        const at = document.activeElement;
        const now = phone && panes.sidebar ? wordmark : placeFocus(route);
        if (now && now !== opening && (at === opening || at === document.body || at === null)) now.focus();
      });
    });
    library.loadSearches();
    library.loadCollections();
    void loadQueue();
    void settings.load().then(() => {
      keepForOffline();
      // This device last saw river mode, but it's inbox now (changed on
      // another device): an untouched home opens on Unread after all.
      if (openedHome && pathFor(route) === pathFor(start) && settings.mode === "inbox" && !(route.kind === "view" && route.view === "unread")) {
        route = { kind: "view", view: "unread" };
        lastPlace = route;
        history.replaceState(history.state, "", pathFor(route));
      }
    });

    return () => {
      clearTimeout(searchTimer);
      queries.forEach((query) => query.removeEventListener("change", resized));
      removeEventListener("popstate", back);
      removeEventListener("keydown", pressed);
      stopWatching();
      stopWaitingForConnection();
      document.removeEventListener("visibilitychange", lookedAgain);
      removeEventListener("online", keepForOffline);
    };
  });

  /** Where the keyboard's place goes on arriving somewhere: its heading, or the add field. */
  function placeFocus(place: Route): HTMLElement | undefined {
    // Edit pages bind their heading to `listHeading` too.
    if (place.kind === "settings") {
      // Back from one of its pages: to the row that opened it, if it's there.
      const row = returnRow ? document.querySelector<HTMLElement>(`[data-settings-row="${returnRow}"]`) : null;
      return row ?? settingsHeading;
    }
    if (place.kind === "feed-health") return healthHeading;
    if (place.kind === "your-feeds") return yourFeedsHeading;
    if (place.kind === "muted") return mutedHeading;
    if (place.kind === "readers") return readersHeading;
    if (place.kind === "add-feed") return addField;
    if (place.kind === "new-to-feeds") return phone ? listHeading : sheetHeading;
    // "Save search" starts in its name field, which the sheet gives the keyboard itself.
    if (place.kind === "save-search" && sheetShown) return undefined;
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
      else if (reading) articleHeading?.focus({ preventScroll: true });
      else if (selected && isList(route)) itemList?.focusSelected();
      else focusArriving(route);
    });
  }

  /**
   * The keyboard's place on arriving back: the row that opened the page, when it's drawn. A row
   * shown only once its page has loaded (Rules' "Muted articles") is waited for a moment; meanwhile
   * the keyboard rests on the heading, and stays wherever the reader moves it.
   */
  function focusArriving(place: Route) {
    const first = placeFocus(place);
    first?.focus();
    const row = returnRow;
    if (!row || place.kind !== "settings" || document.querySelector(`[data-settings-row="${row}"]`)) return;
    let frames = 0;
    const wait = () => {
      if (returnRow !== row || document.activeElement !== first) return;
      const found = document.querySelector<HTMLElement>(`[data-settings-row="${row}"]`);
      if (found) found.focus();
      else if (++frames < 180) requestAnimationFrame(wait);
    };
    requestAnimationFrame(wait);
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

  /** Closes a sheet: a step back if it opened with one, so Back doesn't reopen it. */
  function closeSheet() {
    if (sheetPushed && stepOf(history.state)?.back === "list") history.back();
    else go(under);
  }

  /** The screen as the reader arranged it, for the new version to open the same way (decision 0085). */
  function carried(next: Route): Carried {
    return {
      keyboard: document.documentElement.dataset.keyboard !== undefined,
      sidebar: sidebarChoice,
      listHidden,
      lastPlace: pathFor(isList(next) ? next : lastPlace),
      sidebarScroll: sidebar?.querySelector(".scroller")?.scrollTop ?? 0,
    };
  }

  /** Puts back what the page before the switch carried. Feeds and lists arrive a moment later, so it keeps trying for a few seconds. */
  function arriveSwitched(was: Carried) {
    if (was.keyboard) document.documentElement.dataset.keyboard = "";
    if (width !== "narrow") {
      sidebarChoice = was.sidebar;
      listHidden = was.listHidden;
    }
    const place = parse(was.lastPlace);
    if (isList(place) && !isList(route)) lastPlace = place;
    let [focused, scrolled] = [false, was.sidebarScroll <= 0];
    let frames = 0;
    const settle = () => {
      // Once the reader has put the keyboard's place somewhere, it stays there.
      // (Opening puts it on the wordmark, or the heading, first; see onMount.)
      const at = document.activeElement;
      if (!focused && at && at !== document.body && at !== wordmark && at !== placeFocus(route)) focused = true;
      if (!focused) {
        const heading = placeFocus(route);
        if (heading) {
          heading.focus();
          focused = document.activeElement === heading;
        }
      }
      if (!scrolled) {
        const scroller = sidebar?.querySelector(".scroller");
        if (scroller && scroller.scrollHeight - scroller.clientHeight >= was.sidebarScroll) {
          scroller.scrollTop = was.sidebarScroll;
          scrolled = true;
        }
      }
      // About three seconds at most, then the page is left as it is.
      if (!(focused && scrolled) && ++frames < 180) requestAnimationFrame(settle);
    };
    requestAnimationFrame(settle);
  }

  /**
   * Goes to a place, and moves the keyboard's place to its heading. A list
   * arrived at with a `withNotice` shows it in its line, with Undo.
   */
  function go(next: Route, withNotice?: Notice) {
    const move = moveTo({ route, under, phone }, next);
    // A newer nine turtles is live: going somewhere else redraws the screen
    // anyway, so arrive there in the new version (decision 0085).
    if (!move.keepsArticle && switchesOnMove(updates.ready, marksUnsaved(), !!withNotice)) {
      switchTo(pathFor(next), carried(next));
      return;
    }
    const from = screenNow();
    cameFromSettings = opensFromHere(route, next);
    returnRow = move.returnRow;
    const to: Screen = isList(next) ? "list" : "page";
    let pushed = false;
    if (pathFor(next) !== location.pathname || from !== to) {
      history.pushState({ screen: to, back: from, fromParent: cameFromSettings }, "", pathFor(next));
      pushed = true;
    }
    if (move.opening) {
      sheetOpener.remember(document.activeElement);
      sheetPushed = pushed;
    }
    // Opening a sheet over a place, or closing it back there, keeps that place as it was: its article and its search.
    if (!move.keepsArticle) selected = undefined;
    reading = false;
    notice = withNotice;
    route = next;
    if (!move.sameScreen) resetSearch();
    if (isList(next)) lastPlace = next;
    // A feed or folder added elsewhere (another tab, another device) isn't in the list yet.
    if (next.kind === "feed" && !library.feeds?.some((feed) => feed.id === next.id)) loadFeeds();
    if (next.kind === "folder" && !library.folders.some((folder) => folder.id === next.id)) loadFeeds();
    if (next.kind === "search" && !library.searches.some((search) => search.id === next.id)) library.loadSearches();
    if (next.kind === "collection" && !library.collections.some((collection) => collection.id === next.id)) library.loadCollections();
    // On a phone-narrow window the sidebar is the home screen; choosing a
    // place shows it instead.
    if (width === "narrow") sidebarChoice = "hidden";
    if (move.closing && move.sameScreen && sheetOpener.giveBack()) return;
    if (move.closing) sheetOpener.forget();
    queueMicrotask(() => placeFocus(next)?.focus());
  }

  async function added(feed: Feed) {
    await loadFeeds();
    go({ kind: "feed", id: feed.id });
  }

  /**
   * Starters chosen in the welcome's "New to feeds?" (decision 0079): one opens as a feed added by
   * hand does; several open the home view, where they're all together. Any that couldn't be added
   * are named in the list's note.
   */
  async function startersAdded(feeds: Feed[], failed: Starter[]) {
    await loadFeeds();
    const note = failed.length > 0 ? { message: partlyAdded(failed) } : undefined;
    const [only] = feeds;
    if (feeds.length === 1 && only) go({ kind: "feed", id: only.id }, note);
    else go(home, note);
  }

  /** The empty state's "Import OPML": Settings › Your data. */
  function goImport(event: MouseEvent) {
    follow(event, { kind: "settings", page: "data" });
  }

  /** Back from an edit page, saved or not, to the feed or folder. */
  async function edited(saved: boolean) {
    const id = route.kind === "edit-feed" ? route.id : undefined;
    const pausedBefore = library.feeds?.find((feed) => feed.id === id)?.pausedAt != null;
    if (saved) await loadFeeds();
    // Unpausing a feed puts its newest few back in Unread (SPEC section 15): the list under
    // the sheet shows them unread at once, as the reader's own Save asked.
    const unpaused = pausedBefore && library.feeds?.find((feed) => feed.id === id)?.pausedAt == null;
    if (unpaused) queueMicrotask(() => void itemList?.refresh());
    // On a phone the edit page is a step on from its list: go back that step.
    if (phone && stepOf(history.state)?.back === "list") history.back();
    else if (sheetShown) closeSheet();
    else if (route.kind === "edit-feed") go({ kind: "feed", id: route.id });
    else if (route.kind === "edit-folder") go({ kind: "folder", id: route.id });
  }

  /** Back from "Save search" or "Edit saved search", saved or not. A new saved search opens. */
  function searchSaved(saved?: SavedSearch) {
    // Used: Back to "Save search" later finds nothing to save, and opens the place it was over.
    toSave = undefined;
    if (saved) library.searchSaved(saved);
    if (saved && route.kind === "save-search") {
      go({ kind: "search", id: saved.id });
      return;
    }
    if (phone && stepOf(history.state)?.back === "list") history.back();
    else if (sheetShown) closeSheet();
    else if (route.kind === "edit-search") go({ kind: "search", id: route.id });
    else go(lastPlace);
  }

  /** Deletes a saved search (never an article), then shows Unread (All in river mode) with "Deleted … · Undo". */
  async function deleteSearch(saved: SavedSearch): Promise<string | undefined> {
    const done = await library.deleteSearch(saved);
    if (typeof done === "string") return done;
    toSave = undefined;
    go(home, done);
    return undefined;
  }

  /** "Add to collection…" or l: the sheet of the reader's collections for this article (decision 0108). */
  function openCollecting(article: Article) {
    collectionOpener.remember(document.activeElement);
    collecting = article;
  }

  /** A collection's "Rename…". */
  function openRenaming(collection: Collection) {
    collectionOpener.remember(document.activeElement);
    renaming = collection;
  }

  /** One of the collection sheets closed: the keyboard goes back to what opened it. */
  function collectionSheetClosed() {
    collecting = undefined;
    renaming = undefined;
    collectionOpener.giveBack();
  }

  /**
   * "Add to collection" closed. A Save that took the article off any
   * collection says so in the list's line with Undo, as other removals do,
   * since an article kept only by a collection could otherwise be lost to
   * the yearly clean-up. Inside a collection the article's row stays until
   * the list is next loaded: nothing moves unless you move it.
   */
  function collectingClosed(change?: CollectionChange) {
    const off = change ? takenOff(change, library.collections) : undefined;
    collectionSheetClosed();
    if (change && off) itemList?.offer(off.message, () => putBack(change.article, off.ids));
  }

  /** Deletes a collection (never an article), then shows Unread (All in river mode) with "Deleted … · Undo". */
  async function removeCollection(collection: Collection) {
    const done = await library.deleteCollection(collection);
    if (typeof done === "string") itemList?.say(done);
    else go(home, done);
  }

  /** Unsubscribes, then shows Unread (All in river mode) with "Unsubscribed from … · Undo". */
  async function unsubscribeFrom(feed: Feed): Promise<string | undefined> {
    const done = await library.unsubscribe(feed);
    if (typeof done === "string") return done;
    go(home, done);
    return undefined;
  }

  /** Deletes a folder (never its feeds), then shows Unread (All in river mode) with "Deleted … · Undo". */
  async function deleteThis(folder: Folder): Promise<string | undefined> {
    const done = await library.deleteFolder(folder);
    if (typeof done === "string") return done;
    go(home, done);
    return undefined;
  }

  function follow(event: MouseEvent, next: Route) {
    // Let the browser handle a click meant for a new tab or window.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(next);
  }

  /** Settings › Feed health. */
  function goHealth(event: MouseEvent) {
    follow(event, { kind: "feed-health" });
  }

  /** Settings › Your feeds. */
  function goYourFeeds(event: MouseEvent) {
    follow(event, { kind: "your-feeds" });
  }

  /** Settings › Rules › Muted articles. */
  function goMuted(event: MouseEvent) {
    follow(event, { kind: "muted" });
  }

  /** Settings › Readers › All readers (the owner only). */
  function goReaders(event: MouseEvent) {
    follow(event, { kind: "readers" });
  }

  /** Edit feed's "Add a rule for this feed…": to Settings, where the new rule's sheet opens for the feed. */
  /**
   * Find new address moved a failing feed, from the line above its list or
   * from Edit feed (decision 0106): the feeds load again, so its line and its
   * count are up to date. If others follow the old address too, the reader
   * now follows the new one, under a new number: the list (or Edit feed)
   * goes there in the same step as the feeds arrive, and Edit feed stays the
   * same sheet (`editKey`), so its line still says the feed moved and nothing
   * typed in it is lost. The keyboard moves to the title, as the button it
   * was on has gone.
   */
  async function feedMoved(before: number, after: number, heading: () => HTMLHeadingElement | undefined) {
    if (after !== before) movedFeed = { from: before, to: after };
    await library.loadFeeds(() => {
      if (after !== before) go(route.kind === "edit-feed" ? { kind: "edit-feed", id: after } : { kind: "feed", id: after });
    });
    await tick();
    heading()?.focus();
  }

  /** The last feed moved to a new number by Find new address (decision 0106). */
  let movedFeed: { from: number; to: number } | undefined;
  /** Edit feed's identity: a feed that just moved to a new number keeps its old one, so the sheet isn't rebuilt. */
  function editKey(id: number): number {
    return movedFeed?.to === id ? movedFeed.from : id;
  }

  function addRuleFor(feed: Feed) {
    ruleForFeed = feed.id;
    go({ kind: "settings", page: "rules" });
  }

  /**
   * Close a page opened from Settings (Feed health, Your feeds, Muted articles, All readers, and
   * Settings' own pages, decision 0120), or Escape there: back to the page it was opened from, a
   * step back in history when it came from there.
   */
  function closeHealth() {
    const parent = parentOf(route);
    if (!parent) return;
    if (cameFromSettings) history.back();
    else go(parent);
  }

  /** Close settings, and Escape on Settings or Add a feed: on a phone, back one step to the feeds. */
  function closePage() {
    // "New to feeds?" opens from the welcome on the list's screen: on a phone its X goes back there.
    if (phone && route.kind === "new-to-feeds" && stepOf(history.state)?.back === "list") history.back();
    else if (phone) stepBack("home");
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

  /** ] and the list's button: on a computer, hide the article list so the article has its room, or show it again. */
  function toggleList() {
    if (phone || !isList(route)) return;
    const hiding = panes.list;
    const focusWasInside = listSection?.contains(document.activeElement) ?? false;
    listHidden = hiding;
    if (hiding && focusWasInside) queueMicrotask(() => (selected ? articleHeading : listToggle)?.focus());
  }

  /** \: hide the sidebar and the list together, for just the article; pressed again, both come back. */
  function toggleBoth() {
    if (phone || !isList(route)) return;
    const hiding = panes.sidebar || panes.list;
    const focusWasInside = (sidebar?.contains(document.activeElement) || listSection?.contains(document.activeElement)) ?? false;
    sidebarChoice = hiding ? "hidden" : "shown";
    listHidden = hiding;
    if (hiding && focusWasInside) queueMicrotask(() => (selected ? articleHeading : listToggle)?.focus());
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
  function move(step: 1 | -1, unread = false) {
    if (!itemList || (!panes.list && !panes.article && !reading)) return;
    // With the list hidden there's no row to go to, so the article keeps the keyboard.
    const wasReading = reading || inArticle() || !panes.list;
    // n and Shift+N pass over read articles (decision 0103).
    if (!(unread ? itemList.moveUnread(step) : itemList.move(step))) return;
    showArticleArea();
    if (wasReading) queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
    else itemList.focusSelected();
  }

  /**
   * Home and End: the first or last article in the list, as far as it has
   * loaded (End never loads more; decision 0110). The keyboard's place follows as for j and k.
   */
  function moveToEnd(step: 1 | -1) {
    if (!itemList || (!panes.list && !panes.article && !reading)) return;
    const wasReading = reading || inArticle() || !panes.list;
    if (!itemList.moveToEnd(step)) return;
    showArticleArea();
    if (wasReading) queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
    else itemList.focusSelected();
  }

  /**
   * Shift+J and Shift+K: the feed after or before the place you're in, in
   * the sidebar's order (`feedNextTo`, decision 0110).
   */
  function feedAfter(step: 1 | -1): Route | undefined {
    if (!library.feeds) return undefined;
    const open = phone ? library.folders.map((folder) => folder.id) : (sidebarFeeds?.openFolders() ?? savedOpenFolders());
    const id = feedNextTo({ feeds: library.feeds, folders: library.folders }, open, route, step);
    return id === undefined ? undefined : { kind: "feed", id };
  }

  /**
   * Enter and o: open the selected article (the first, if none is selected
   * yet) to read. An article from a feed set to open on the website opens
   * the publisher's page in a new tab instead, and counts as read (SPEC
   * section 15); on a computer its summary stays beside the list.
   */
  function open() {
    if (!itemList || (!panes.list && !panes.article && !reading)) return;
    if (!selected && !itemList.move(1)) return;
    const article = selected;
    if (article?.link && !reading && !inArticle() && library.feeds?.find((feed) => feed.id === article.feedId)?.openOnSite) {
      window.open(article.link, "_blank", "noopener,noreferrer");
      itemList.shown(article);
      return;
    }
    if (phone && !reading) {
      // On a phone the article is a screen of its own, one step on.
      history.pushState({ screen: "article", back: "list" }, "", location.pathname);
      reading = true;
    }
    showArticleArea();
    queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
  }

  /** Choosing an article shows it, so on a medium window the sidebar makes way. */
  function showArticleArea() {
    if (width === "medium" && panes.sidebar) sidebarChoice = "hidden";
  }

  /** "Skip to articles" is offered only while a list of articles is on screen. */
  let skipShown = $derived(isList(route) && panes.list && !welcoming && !missing && !sheetShown);

  /** "Skip to articles": the keyboard goes to the chosen article in the list, or the first; with none, to the list's title. */
  function skipToArticles(event: MouseEvent) {
    event.preventDefault();
    if (!itemList?.focusList()) listHeading?.focus();
  }

  function chose(byKeyboard: boolean) {
    if (width === "narrow" || byKeyboard) open();
    else showArticleArea();
  }

  /**
   * The "now playing" bar's title: opens the episode playing (SPEC section 35). Where it isn't
   * the article on screen, its podcast's list opens with it chosen, and the keyboard goes to it.
   */
  function openEpisode(article: Article) {
    if (selected?.id !== article.id) {
      if (!(isList(route) && route.kind === "feed" && route.id === article.feedId)) go({ kind: "feed", id: article.feedId });
      selected = article;
    }
    if (phone && !reading) {
      history.pushState({ screen: "article", back: "list" }, "", location.pathname);
      reading = true;
    }
    showArticleArea();
    queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
  }

  // Up Next's list follows only the reader's own changes to it (Move, Remove, Undo, Add), never the removal when
  // an episode starts by itself or by hand: nothing moves unless you move it (principle 5, decision 0113).
  $effect(() => {
    void player.changes;
    untrack(() => {
      if (!shown && under.kind === "view" && under.view === "upnext") void itemList?.refresh();
    });
  });

  /**
   * Up Next's sidebar row, once shown, stays while it empties, until the reader next goes somewhere: then it
   * leaves (decision 0113).
   */
  let upNextStays = $state(false);
  $effect(() => {
    if (player.upNext?.length) upNextStays = true;
  });
  $effect(() => {
    void route;
    untrack(() => (upNextStays = Boolean(player.upNext?.length)));
  });

  /** Back from the article to its row in the list. */
  function backToList() {
    if (reading) {
      stepBack("list");
      return;
    }
    if (!panes.list) return;
    itemList?.focusSelected();
  }

  /** What an empty list says, plainly. */
  function emptyText(place: Route): string {
    if (place.kind === "feed") return "This feed has no articles yet.";
    if (place.kind === "folder") return "No articles in this folder yet.";
    if (place.kind === "view" && place.view === "unread") return "Nothing unread.";
    if (place.kind === "view" && place.view === "starred") return "No starred articles yet.";
    if (place.kind === "view" && place.view === "recent") return "Articles you open will show here.";
    if (place.kind === "view" && place.view === "upnext") return "Nothing in Up Next. Add an episode from its More menu.";
    if (place.kind === "collection") return "Nothing in this collection yet. Articles you put here stay, even after a year. Add one from an article's More menu.";
    return "No articles yet.";
  }

  /** Search starts afresh, limited to where you are; on a saved search, as it was saved. */
  function resetSearch() {
    clearTimeout(searchTimer);
    phoneSearch = false;
    // `under`: the saved search under its Edit sheet runs too.
    const place = under;
    const saved = place.kind === "search" ? library.searches.find((search) => search.id === place.id) : undefined;
    query = saved ? $state.snapshot(saved.query) : emptyQuery(route);
    shown = saved && isSearching(saved.query) ? $state.snapshot(saved.query) : undefined;
  }

  /** `/`: into the search field, from wherever you are; Escape comes back here. */
  function startSearch() {
    if (!isList(route) || (phone && panes.sidebar)) go(lastPlace);
    else if (reading) backToList();
    else beforeSearch = document.activeElement;
    phoneSearch = true;
    queueMicrotask(() => searchBar?.focus());
  }

  /** The phone's Search button: shows the field, ready to type in; pressed again with nothing searched, puts it away. */
  function toggleSearch() {
    if (phoneSearch && !shown && !isSearching(query)) phoneSearch = false;
    else startSearch();
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
    if (parentOf(route)) closeHealth();
    else if (route.kind === "settings" || route.kind === "add-feed" || route.kind === "new-to-feeds") closePage();
    else if (route.kind === "edit-feed" || route.kind === "edit-folder") edited(false);
    else if (route.kind === "save-search" || route.kind === "edit-search") searchSaved();
    else if (reading || (selected && inArticle())) backToList();
    else if (route.kind === "search" ? tweaked || document.activeElement?.closest("search") : shown || isSearching(query) || phoneSearch || document.activeElement?.closest("search"))
      closeSearch();
    else if (phone && !panes.sidebar) stepBack("home");
  }

  /** The screen as a shortcut sees it, at the moment of the press (`shortcuts.ts`). */
  function keyScene(): KeyScene {
    return {
      river,
      onList: isList(route),
      searching: shown !== undefined,
      ownOrder: route.kind === "view" && (route.view === "recent" || route.view === "upnext") && !shown,
      sidebar: panes.sidebar,
      list: panes.list,
      article: panes.article,
      reading,
      inArticle: inArticle(),
      selected: selected !== undefined,
      link: selected?.link ?? undefined,
      articleDrawn: articleView != null,
      feed: currentFeed?.id,
      folder: currentFolder?.id,
      feedsFolder: currentFeed?.folders[0],
      textSize: preferences.textSize,
    };
  }

  /** What a shortcut can ask of the screen. */
  const keyHands: KeyHands = {
    openCheatSheet: () => (cheatSheetOpen = true),
    toggleSidebar,
    toggleList,
    toggleBoth,
    go: (place) => go(place),
    escape,
    startSearch,
    move,
    moveToEnd,
    feedAfter,
    open,
    openLink: (link) => window.open(link, "_blank", "noopener,noreferrer"),
    page: (step) => articleView?.page(step),
    copyLink: () => articleView?.copyLink(),
    markOlderRead: () => itemList?.markPast("older"),
    markAllRead: () => itemList?.markAllRead(),
    toggleFolder: (id) => sidebarFeeds?.toggleFolder(id),
    star: () => itemList?.toggleStar(),
    collect: () => {
      if (selected) openCollecting(selected);
    },
    markUnread: () => itemList?.markUnread(),
    undo: () => itemList?.undo(),
    refresh: () => itemList?.refresh(),
    setTextSize: (size) => (preferences.textSize = size),
  };
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
      <!-- For someone who has never used feeds: what they are, and a few to start with, in a sheet (decision 0079). -->
      <a href="/new-to-feeds" onclick={(event) => follow(event, { kind: "new-to-feeds" })} class="text-link mt-1">New to feeds? Start here</a>
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
          <a href="/settings/data" onclick={goImport} class="text-link">Import an OPML file…</a>
        {/snippet}
      </AddFeed>
    {:else}
      <!--
        With the Add a feed sheet over it, the field is the sheet's (one field of that name on the page).
        The welcome keeps its exact shape under the dim, a still picture of itself that nothing can
        reach, so nothing behind the sheet moves as it opens or closes (decision 0048).
      -->
      <div inert aria-hidden="true" class="flex flex-col gap-1.5">
        <div class="welcome-row flex gap-2">
          <span class="field flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap text-muted"><span class="welcome-hint">Paste a website or feed URL</span></span>
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
                  {#if phone}
                    <!-- The way into search, beside More, as an iOS list keeps it (decision 0060). -->
                    <button type="button" aria-label="Search" title="Search" aria-expanded={phoneSearch || shown !== undefined || isSearching(query)} onclick={toggleSearch} class="btn-quiet btn-icon"
                      ><span class="flex size-8 items-center justify-center"><Icon name="search" size={20} /></span></button
                    >
                  {/if}
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
<svelte:window bind:innerWidth={windowWidth} />
<!--
  While an episode is in the player, the "now playing" bar takes its own room at the foot (SPEC section 35), so the
  panes above it end where it starts and it never covers them. On a phone reading an article, it sits above the
  article's toolbar instead.
-->
<main class="relative flex h-dvh flex-col overflow-hidden" style:--sidebar-w={`${sidebarWidth ?? 256}px`}>
  {#if skipShown}
    <!--
      First in the Tab order (SPEC section 19; the keyboard itself starts later, on the list's title): out of sight until the keyboard reaches it, then a small
      label at the top left. It goes past the sidebar to the articles: the chosen one, or the first.
    -->
    <a href="#list-pane" class="skip-link" onclick={skipToArticles}>Skip to articles</a>
  {/if}
  <div class="relative flex min-h-0 flex-1 overflow-hidden">
  {#if !panes.sidebar}
    <!-- The wordmark is the page's main heading; with the sidebar hidden, screen readers still find it. -->
    <h1 class="sr-only">nine turtles</h1>
  {/if}
  <!--
    On a phone there's no sidebar toggle: the feeds list is the home screen, reached with the back arrow.
    Everywhere else it sits on the sidebar it controls, at the right end of its top line across from
    the wordmark; with the sidebar hidden it waits at the start of the next area's top line. It's one
    button that moves, so the keyboard stays on it. Each area's top line (the wordmark, the list's
    title, the article's tools) never scrolls, so nothing passes under it.
  -->
  <div class={["fixed top-1.5 z-10", panes.sidebar ? "left-[calc(var(--sidebar-w)-3.25rem)]" : "left-2", phone && "hidden"]}>
    <button
      type="button"
      bind:this={sidebarToggle}
      aria-label={bothHidden ? "Sidebar and article list" : "Sidebar"}
      aria-expanded={panes.sidebar}
      aria-controls={bothHidden ? "sidebar list-pane" : "sidebar"}
      title={bothHidden ? tip("Show the sidebar and the article list", "toggle-both") : tip(panes.sidebar ? "Hide the sidebar" : "Show the sidebar", "toggle-sidebar")}
      onclick={bothHidden ? toggleBoth : toggleSidebar}
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
    class={["relative flex-col bg-sidebar", panes.list || panes.article ? "w-[var(--sidebar-w)] shrink-0" : "min-w-0 flex-1", panes.sidebar && "flex", !phone && "pane-edge"]}
  >
    <!--
      The sidebar's top line (decision 0043): the wordmark, on the same line as the list's title and
      the article's tools, in a band of the shared height. It never scrolls; the places below it do,
      with a faint line under it once they have.
    -->
    <div class={["pane-bar gap-4", phone ? "pr-4 pl-5" : "pr-14 pl-5"]}>
        <!-- A name, not a control: never a Tab stop; the keyboard lands here only when the screen opens (decision 0041). -->
        <h1 class={["wordmark mr-auto flex items-center gap-2.5 font-serif font-semibold tracking-[-0.01em]", phone ? "text-xlarge" : "text-large text-ink-2"]} tabindex="-1" bind:this={wordmark}><Logo height={phone ? 32 : 23} />nine turtles</h1>
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
      {#if library.feeds === undefined || library.feeds.length > 0}
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
        {#each sidebarViews as view (view)}
          {@const current = !phone && route.kind === "view" && route.view === view}
          <!-- On a phone the feeds screen is the root of a stack: nothing is selected there, and each row leads on with a chevron (decision 0041). -->
          <li>
            <a
              href={pathFor({ kind: "view", view })}
              aria-current={current ? "page" : undefined}
              onclick={(event) => follow(event, { kind: "view", view })}
              class={[
                "place mx-2 flex min-h-11 pointer-fine:min-h-8 items-center gap-2.5 pr-3.5 pl-3 text-ui pointer-fine:text-small",
                current ? "font-semibold text-ink" : "text-ink-2",
              ]}
              ><span class={current ? (view === "starred" ? "text-star" : "text-ink") : "text-muted"}><Icon name={VIEW_ICONS[view]} size={16} filled={view === "starred" && current} /></span
              ><span class="min-w-0 flex-1">{VIEW_NAMES[view]}</span>{#if phone}<span class="-mr-1 shrink-0 text-muted"><Icon name="chevron-right" size={16} /></span>{/if}</a
            >
          </li>
        {/each}
      </ul>
      {#if library.feeds}
        <SidebarFeeds
          bind:this={sidebarFeeds}
          feeds={library.feeds}
          folders={library.folders}
          searches={settings.hidden.includes("searches") ? [] : library.searches}
          collections={settings.hidden.includes("collections") ? [] : library.collections}
          {route}
          {search}
          {follow}
          {phone}
          {river}
          numbers={settings.counts === "shown"}
        />
      {/if}
      {#if library.feedsFailed}
        <p class="px-4 pt-4 text-small">Your feeds couldn't be loaded. Reload the page to try again.</p>
      {/if}
    </div>
    <!--
      Always at the very bottom, outside the scrolling list, so it never moves:
      Add feed and Keys (the shortcut list), each an icon and a word, so they
      read as two buttons, not one phrase (decisions 0062, 0064), then
      Settings as an icon, the way a Mac app keeps its tools at the foot of
      the sidebar. In a sidebar narrowed below 15rem, Keys keeps only its icon.
    -->
    <div class="@container flex shrink-0 items-center gap-1 border-t border-ink/10 py-1.5 pr-3">
      <!-- An action, not a place: it never shows the "where you are" bar. -->
      <a
        href="/add-feed"
        onclick={(event) => follow(event, { kind: "add-feed" })}
        class="btn-quiet ml-1.5 min-w-0 flex-1 justify-start gap-2.5 pl-[14px] text-small text-ink-2 @max-[15rem]:ml-0 @max-[15rem]:gap-1.5 @max-[15rem]:pr-1.5 @max-[15rem]:pl-1.5"><Icon name="plus" size={16} />Add feed</a
      >
      {#if !phone}
        <!-- Filled in a neutral ink tone while the shortcut list is open (never the accent: this is a button, not a place), and it says it opens a dialog (decision 0054). -->
        <button
          type="button"
          onclick={() => (cheatSheetOpen = true)}
          aria-label="Keys (keyboard shortcuts)"
          title="Keyboard shortcuts (?)"
          aria-haspopup="dialog"
          aria-expanded={cheatSheetOpen}
          class={["btn-quiet gap-2.5 px-2.5 text-small text-ink-2 @max-[15rem]:w-11 @max-[15rem]:px-0", cheatSheetOpen && "bg-ink/10 text-ink"]}
          ><Icon name="keyboard" size={16} /><span class="@max-[15rem]:hidden">Keys</span></button
        >
      {/if}
      <a
        href="/settings"
        aria-label="Settings"
        title="Settings"
        aria-current={inSettings(route) ? "page" : undefined}
        onclick={(event) => follow(event, { kind: "settings" })}
        class={["btn-quiet btn-icon @max-[15rem]:-mr-1.5", inSettings(route) && "bg-tint-sidebar text-ink"]}><Icon name="settings" size={18} /></a
      >
    </div>
    {#if !phone && (panes.list || panes.article)}
      <PaneResizer
        label="Resize the sidebar"
        bind:width={sidebarWidth}
        min={200}
        max={400}
        pane={sidebar}
        onDone={() => storeWidth("nine-turtles.sidebar-width", sidebarWidth)}
      />
    {/if}
  </nav>

  {#if panes.list || panes.article}
    <div class="relative flex min-w-0 flex-1">
      {#if route.kind === "settings"}
        <Settings
          page={route.page}
          onOpen={(event, page) => follow(event, { kind: "settings", page })}
          onBack={closeHealth}
          bind:preferences
          sort={settings.sort}
          onSort={(next) => settings.changeSort(next)}
          mode={settings.mode}
          onMode={(next) => settings.changeMode(next)}
          counts={settings.counts}
          onCounts={(next) => settings.changeCounts(next)}
          letGo={settings.letGo}
          onLetGo={(next) => settings.changeLetGo(next)}
          hidden={settings.hidden}
          onHidden={(next) => settings.changeHidden(next)}
          bind:heading={settingsHeading}
          {version}
          {owner}
          {email}
          {emailSending}
          {passkeys}
          {onSignedOut}
          onClose={closePage}
          onImported={loadFeeds}
          onFeedHealth={goHealth}
          onYourFeeds={goYourFeeds}
          onKeys={() => {
            cheatSheetEditing = true;
            cheatSheetOpen = true;
          }}
          onMuted={goMuted}
          onReaders={goReaders}
          feeds={library.feeds ?? []}
          folders={library.folders}
          {phone}
          bind:ruleForFeed
          besideToggle={!phone && !panes.sidebar}
        />
      {:else if route.kind === "feed-health"}
        <FeedHealth bind:heading={healthHeading} onClose={closeHealth} onFeedsChanged={loadFeeds} besideToggle={!phone && !panes.sidebar} />
      {:else if route.kind === "your-feeds"}
        <YourFeeds
          bind:heading={yourFeedsHeading}
          onClose={closeHealth}
          onOpenFeed={(event, id) => follow(event, { kind: "feed", id })}
          onFeedsChanged={loadFeeds}
          besideToggle={!phone && !panes.sidebar}
        />
      {:else if route.kind === "muted"}
        <Muted bind:heading={mutedHeading} onClose={closeHealth} onChanged={loadFeeds} besideToggle={!phone && !panes.sidebar} />
      {:else if route.kind === "readers"}
        <ReadersPage bind:heading={readersHeading} onClose={closeHealth} besideToggle={!phone && !panes.sidebar} />
      {:else if !sheet && route.kind === "edit-feed" && currentFeed}
        {#key editKey(currentFeed.id)}
          <EditFeed
            feed={currentFeed}
            folders={library.folders}
            bind:heading={listHeading}
            besideToggle={!phone && !panes.sidebar}
            {river}
            onSaved={() => edited(true)}
            onCancel={() => edited(false)}
            onUnsubscribe={() => unsubscribeFrom(currentFeed!)}
            onAddRule={() => addRuleFor(currentFeed!)}
            onMoved={(after) => feedMoved(currentFeed!.id, after.id, () => listHeading)}
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
      {:else if !sheet && route.kind === "new-to-feeds" && firstVisit}
        <section aria-labelledby="list-heading" class="page-sheet">
          <!-- Only on a phone: the phone sheet's one build, as Add a feed's (decisions 0052, 0055). -->
          <div class="page-sheet-card">
            <PageHead title="New to feeds?" bind:heading={listHeading} besideToggle={false} onClose={closePage} closeLabel="Close" />
            <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
              <div class="mx-auto flex w-full max-w-xl flex-1 flex-col">
                <StarterFeeds onAdded={startersAdded} page />
              </div>
            </div>
          </div>
        </section>
      {:else if !sheet && route.kind === "save-search" && toSave}
        <EditSearch
          query={toSave}
          library={library.names}
          bind:heading={listHeading}
          besideToggle={!phone && !panes.sidebar}
          onSaved={searchSaved}
          onCancel={() => searchSaved()}
        />
      {:else if !sheet && route.kind === "edit-search" && currentSearch}
        {#key currentSearch.id}
          <EditSearch
            saved={currentSearch}
            query={toSave ?? currentSearch.query}
            library={library.names}
            bind:heading={listHeading}
            besideToggle={!phone && !panes.sidebar}
            onSaved={searchSaved}
            onCancel={() => searchSaved()}
            onDelete={() => deleteSearch(currentSearch!)}
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
                <AddFeed bind:field={addField} feeds={library.feeds ?? []} onAdded={added} onOpen={(id) => go({ kind: "feed", id })} page {shared} onShared={() => (shared = "")} />
              </div>
            </div>
          </div>
        </section>
      {:else}
        {#if !phone && !welcoming && !bothHidden}
          <!--
            The article list's button, on a computer: at the right end of the list's own top line, as the
            sidebar's sits on its own; with the list hidden it waits at the start of the article's top
            line, after the sidebar's. One button that moves, so the keyboard stays on it.
          -->
          <div
            class={[
              "absolute top-1.5 z-20",
              !panes.list
                ? panes.sidebar ? "left-2" : "left-14"
                : panes.article ? (listWidth ? "" : "left-[calc(22rem-3.25rem)] xl:left-[calc(24rem-3.25rem)] 2xl:left-[calc(26rem-3.25rem)]") : "right-2",
            ]}
            style:left={panes.list && panes.article && listWidth ? `${Math.max(LIST_MIN, listWidth) - 52}px` : undefined}
          >
            <button
              type="button"
              bind:this={listToggle}
              aria-label="Article list"
              aria-expanded={panes.list}
              aria-controls="list-pane"
              title={tip(panes.list ? "Hide the article list" : "Show the article list", "toggle-list")}
              onclick={toggleList}
              class="bar-button flex size-11 items-center justify-center rounded-md text-ink-2"
            >
              <!-- The same sidebar icon as the sidebar's button, as Apple Mail uses one for each pane; where it sits says which. -->
              <Icon name="sidebar" size={20} />
            </button>
          </div>
        {/if}
        <section
          aria-labelledby="list-heading"
          bind:this={listSection}
          id="list-pane"
          hidden={!panes.list || welcomeWide}
          class={[
            // A container, so the list's title can step down a size when the pane is narrow (decision 0041).
            "list-pane relative @container flex-col bg-list",
            phone && "phone",
            // 352px by default below 1280px, so on a window about 1024px wide feed names and titles have room (SPEC section 4).
            panes.article ? "w-[22rem] shrink-0 xl:w-96 2xl:w-[26rem]" : "min-w-0 flex-1",
            panes.list && !welcomeWide && "flex",
            // A 1px line where the list meets the reading pane, as where the sidebar meets the list (decision 0054).
            !phone && panes.article && "pane-edge",
          ]}
          style:width={!phone && panes.article && listWidth ? `${Math.max(LIST_MIN, listWidth)}px` : undefined}
        >
          {#if !phone && panes.article && !welcomeWide}
            <PaneResizer
              label="Resize the article list"
              bind:width={listWidth}
              min={LIST_MIN}
              max={Math.max(LIST_MIN, Math.min(640, windowWidth - (panes.sidebar ? (sidebarWidth ?? 256) : 0) - 400))}
              pane={listSection}
              onDone={() => storeWidth("nine-turtles.list-width", listWidth)}
            />
          {/if}
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
            <div class={["pane-bar", welcoming ? "pr-[var(--list-end)]" : "pr-14", panes.sidebar ? "pl-[var(--list-start)]" : "pl-16"]}>
              {@render listHead()}
            </div>
          {/if}
          <!-- A column, so the floating note can sit at the pane's foot even under a short list. -->
          <div use:edge class="scroller relative flex min-h-0 flex-1 scroll-pb-20 flex-col overflow-y-auto pt-2 pr-[var(--list-end)] pb-6 pl-[var(--list-start)]">
            {#if library.feeds && library.feeds.length > 0 && !missing && (!phone || phoneSearch || shown || isSearching(query))}
              <SearchBar bind:this={searchBar} {query} feeds={library.feeds} folders={library.folders} collections={library.collections} here={scopeFor(under)} found={listFound} {river} onChange={searchChanged} />
            {/if}
            {#if missing && (under.kind === "folder" || under.kind === "edit-folder")}
              <p class="mt-4">There's no folder here. It may have been deleted or renamed.</p>
            {:else if under.kind === "search" && library.searchesFailed && !currentSearch}
              <p class="mt-4">Your saved searches couldn't be loaded. Reload the page to try again.</p>
            {:else if missing && (under.kind === "search" || under.kind === "edit-search")}
              <p class="mt-4">There's no saved search here. It may have been deleted.</p>
            {:else if under.kind === "collection" && library.collectionsFailed && !currentCollection}
              <p class="mt-4">Your collections couldn't be loaded. Reload the page to try again.</p>
            {:else if missing && under.kind === "collection"}
              <p class="mt-4">There's no collection here. It may have been deleted.</p>
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
            {:else if library.feeds !== undefined && settings.sort !== undefined && (under.kind !== "search" || library.searchesLoaded) && (under.kind !== "collection" || library.collectionsLoaded)}
              {#if under.kind === "feed" && !shown && currentFeed}
                <!-- A feed that isn't working says so above its list, with Find new address (decision 0106). -->
                <FailingLine
                  class="pt-1 pb-2"
                  feed={currentFeed}
                  label="Find its new address"
                  onMoved={(after) => feedMoved(currentFeed!.id, after.id, () => listHeading)}
                />
              {/if}
              <!-- The list, with "New articles · press r" and Undo in a note floating at its foot (More, with Refresh, sits beside the title). -->
              {#key listKey}
                <ItemList
                  bind:this={itemList}
                  bind:selected
                  {source}
                  order={settings.sort}
                  {notice}
                  empty={shown ? "Nothing found." : emptyText(under)}
                  bold={shown ? searchedTerms(shown.words) : []}
                  onChoose={chose}
                  onUnreadChange={(feedId, change) => library.unreadChanged(feedId, change)}
                  onRefresh={() => {
                    loadFeeds();
                    // What a refresh brought is kept for reading offline too, at most once a minute.
                    if (Date.now() - lastKept > 60_000) keepForOffline();
                  }}
                  onCounts={loadFeeds}
                  results={shown !== undefined}
                  oneFeed={under.kind === "feed" && !shown}
                  {river}
                  {flowing}
                  bind:count={listCount}
                  bind:found={listFound}
                />
              {/key}
            {/if}
          </div>
        </section>
        {#if panes.article}
          <!-- The reading area; with the list hidden, the list's button waits at the start of its top line. -->
          <div class="flex min-w-0 flex-1">
          {#if selected}
            <ArticleView
              bind:this={articleView}
              article={selected}
              toggles={phone || panes.list ? 0 : 1}
              bind:heading={articleHeading}
              bind:preferences
              onStar={() => itemList?.toggleStar()}
              onMarkUnread={() => itemList?.markUnread()}
              onCollect={() => openCollecting(selected!)}
              beforeToolbar={nowPlayingAboveToolbar}
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
              <div class="relative">
                <p class="reading-empty">Time to read something beautiful.</p>
                {#if listCount > 0 && !missing}
                  <!-- The reader's own key for the next article, if they kept one (decision 0110). -->
                  {@const first = currentKeyOf("next-article")}
                  {@const cap = first ? keyCap(first) : undefined}
                  {#if tipSeen}
                    <p class="sr-only">Choose one from the list{#if cap}<span class="keyboard-hint">, or press {cap.spoken ?? cap.cap}</span>{/if}.</p>
                  {:else}
                    <!--
                      Once, on a screen with a keyboard: the two keys worth knowing first, quietly, under the
                      line (decision 0062). Touch screens hear and see only "Choose one from the list."
                    -->
                    <p class="shortcut-tip keyboard-hint absolute top-full left-1/2 w-[min(28rem,80vw)] -translate-x-1/2">
                      {#if cap}Press {#if cap.spoken}<kbd class="key" aria-hidden="true">{cap.cap}</kbd><span class="sr-only">{cap.spoken}</span>{:else}<kbd class="key">{cap.cap}</kbd>{/if} to open the first article, or <kbd class="key">?</kbd> for every shortcut.{:else}Press <kbd class="key">?</kbd> for every shortcut.{/if}
                    </p>
                    <p class="sr-only touch-only">Choose one from the list.</p>
                  {/if}
                {/if}
              </div>
            </section>
          {/if}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
  </div>
  {#if !(phone && reading && panes.article && selected)}
    <NowPlaying onOpen={openEpisode} stepAside={phone} />
  {/if}
</main>

{#snippet nowPlayingAboveToolbar()}
  <NowPlaying onOpen={openEpisode} bottom={false} stepAside />
{/snippet}

<CheatSheet bind:open={cheatSheetOpen} bind:editing={cheatSheetEditing} {river} />

{#if collecting}
  <AddToCollection article={collecting} collections={library.collections} onMade={(made) => library.collectionMade(made)} onClose={collectingClosed} />
{:else if renaming}
  {#key renaming.id}
    <RenameCollection
      collection={renaming}
      onSaved={(name) => {
        if (renaming) library.collectionRenamed(renaming.id, name);
        collectionSheetClosed();
      }}
      onCancel={collectionSheetClosed}
    />
  {/key}
{/if}

{#if sheet && route.kind === "add-feed"}
  <Sheet title="Add a feed" bind:heading={sheetHeading} onClose={closePage} initial={() => addField}>
    <p>{ADD_INTRO}</p>
    <AddFeed bind:field={addField} feeds={library.feeds ?? []} onAdded={added} onOpen={(id) => go({ kind: "feed", id })} onCancel={closePage} {shared} onShared={() => (shared = "")} />
  </Sheet>
{:else if sheet && route.kind === "new-to-feeds" && firstVisit}
  <Sheet title="New to feeds?" bind:heading={sheetHeading} onClose={closePage}>
    <StarterFeeds onAdded={startersAdded} onCancel={closePage} />
  </Sheet>
{:else if sheet && route.kind === "edit-feed" && currentFeed}
  {#key editKey(currentFeed.id)}
    <EditFeed
      sheet
      feed={currentFeed}
      folders={library.folders}
      bind:heading={sheetHeading}
      {river}
      onSaved={() => edited(true)}
      onCancel={() => edited(false)}
      onUnsubscribe={() => unsubscribeFrom(currentFeed!)}
      onAddRule={() => addRuleFor(currentFeed!)}
      onMoved={(after) => feedMoved(currentFeed!.id, after.id, () => sheetHeading)}
    />
  {/key}
{:else if sheet && route.kind === "save-search" && toSave}
  <EditSearch sheet query={toSave} library={library.names} bind:heading={sheetHeading} onSaved={searchSaved} onCancel={() => searchSaved()} />
{:else if sheet && route.kind === "edit-search" && currentSearch}
  {#key currentSearch.id}
    <EditSearch
      sheet
      saved={currentSearch}
      query={toSave ?? currentSearch.query}
      library={library.names}
      bind:heading={sheetHeading}
      onSaved={searchSaved}
      onCancel={() => searchSaved()}
      onDelete={() => deleteSearch(currentSearch!)}
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
