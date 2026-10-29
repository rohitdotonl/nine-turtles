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
  import MoreMenu from "./MoreMenu.svelte";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import Settings from "./Settings.svelte";
  import FeedHealth from "./FeedHealth.svelte";
  import YourFeeds from "./YourFeeds.svelte";
  import Welcome from "./Welcome.svelte";
  import Muted from "./Muted.svelte";
  import ReadersPage from "./ReadersPage.svelte";
  import SearchBar from "./SearchBar.svelte";
  import SidebarFeeds from "./SidebarFeeds.svelte";
  import StarterFeeds from "./StarterFeeds.svelte";
  import { partlyAdded, type Starter } from "./starters";
  import type { Article, Feed, Folder, Source } from "./shapes";
  import { homeView } from "./reading";
  import { ReadingSettings } from "./reading-settings.svelte";
  import type { Notice } from "./feeds";
  import { marksUnsaved } from "./saving";
  import { createKeyReader, keyCap } from "./keyboard";
  import { listMenu, type MenuHands, type MenuScene } from "./listMenu";
  import { carryOut, keyIsOurs, type KeyHands, type KeyScene } from "./shortcuts";
  import { currentKey, currentKeyOf, keys, tip } from "./keys.svelte";
  import { currentWidth, LIST_MIN, ScreenLayout, watchWidth } from "./layout.svelte";
  import { apply, load, save } from "./preferences";
  import { device } from "./appearance.svelte";
  import { VIEWS, VIEW_NAMES, inSettings, nameFor, parentOf, parse, pathFor, titleFor, type Route, type View } from "./router";
  import { sharedAddress } from "./share";
  import { scopeFor, searchParams, searchedTerms } from "./search";
  import { sameQuery, type SavedSearch } from "./saved";
  import type { Collection, CollectionChange } from "./collections";
  import { CollectionSheets } from "./collecting.svelte";
  import { Searching } from "./searching.svelte";
  import { LoadedLibrary } from "./library.svelte";
  import { emptyText, insteadOfList, missingFrom, type Found } from "./listWording";
  import { headingFor, placeNameOf } from "./listHeading";
  import { focusArriving, landingFor, type Headings } from "./landing";
  import { moveArticle, nextFeed, type ArticleMove } from "./moving";
  import { isFirstVisit, newToFeedsGivesWay, welcomeFor } from "./firstVisit";
  import { startingStep, stepOf, type Screen } from "./steps";
  import { homeFor, isList, isOver, moveTo, Opener, opensFromHere, Steps, underSheet } from "./navigation";
  import { Keeper, keepUpToDate } from "./offline";
  import NowPlaying from "./NowPlaying.svelte";
  import { loadQueue, player } from "./player.svelte";
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
    if (under.kind === "search" && !searching.shown && currentSearch) resetSearch();
  });
  /** Feeds set to flow past in Edit feed: no count, and their rows look as in river mode (SPEC section 15). */
  let flowing = $derived(new Set((library.feeds ?? []).filter((feed) => feed.river).map((feed) => feed.id)));
  /** "Add to collection" and a collection's "Rename…" (collecting.svelte.ts, decision 0108). */
  const collectionSheets = new CollectionSheets();
  /** What's typed in the sidebar search. */
  let search = $state("");
  /** What the next list's line says on arrival (after unsubscribing or deleting a folder). */
  let notice: Notice | undefined = $state();
  let preferences = $state(load());
  /** Which screen this history entry shows (see steps.ts). */
  const firstStep = startingStep(history.state, currentWidth() === "narrow", location.pathname, isList(start));
  let cheatSheetOpen = $state(false);
  /** The shortcut list opens ready to change keys: from Settings › Keyboard (decision 0110). */
  let cheatSheetEditing = $state(false);
  /** The article chosen in the list, shown in the reading area. */
  let selected: Article | undefined = $state();
  /** On a phone-narrow window, the opened article takes the list's place. */
  let reading = $state(false);
  /** What the search field holds, the search the list shows and the phone's search field (searching.svelte.ts, SPEC section 14). */
  const searching = new Searching(start);
  let searchBar: SearchBar | undefined = $state();

  /** The window's width step, which areas show, the sidebar and list toggles and their dragged widths (layout.svelte.ts). */
  const layout = new ScreenLayout(currentWidth(), innerWidth, () => reading, firstStep.screen === "home");
  let panes = $derived(layout.panes);
  let phone = $derived(layout.phone);

  let wordmark: HTMLHeadingElement | undefined = $state();
  /** The headings (and the add field) the keyboard's place lands on (`landing.ts`). */
  const headings: Headings = $state({});
  /** "Add a rule for this feed…" in Edit feed: Settings opens with a new rule for it. */
  let ruleForFeed: number | undefined = $state();
  /** Feed health, Your feeds, Muted articles or Readers was opened from Settings, so closing it is a step back in history. */
  let cameFromSettings = false;
  /** Back from a page opened from Settings: the row on its parent page that opened it, for the keyboard to return to (decision 0120). */
  let returnRow: string | undefined;
  let sidebar: HTMLElement | undefined = $state();
  let articleHeading: HTMLHeadingElement | undefined = $state();
  let itemList: ItemList | undefined = $state();
  let articleView: ArticleView | undefined = $state();
  let sidebarFeeds: SidebarFeeds | undefined = $state();
  /** The list's pane and the sidebar button, for where the keyboard goes when the sidebar hides. */
  let listSection: HTMLElement | undefined = $state();
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

  let sidebarToggle: HTMLButtonElement | undefined = $state();
  let listToggle: HTMLButtonElement | undefined = $state();

  /**
   * On a window wide enough for the list, the short tasks (adding a feed, editing, saving a
   * search, "New to feeds?"; `isOver`) open as a sheet over the place you were, which stays in view.
   */
  let sheet = $derived(!phone && isOver(route));
  /** Where the list and article come from: under a sheet, the place it opened over (navigation.ts). */
  let under: Route = $derived(underSheet(route, lastPlace, phone));
  /** What had the keyboard when a sheet opened, to give it back when the sheet closes. */
  const sheetOpener = new Opener();
  /** The browser's history: the step each move adds, and the steps back (navigation.ts). */
  const steps = new Steps({ arrive, goUnder: () => go(under) });

  /** Which articles the list shows here. */
  let source: Source = $derived(
    searching.shown
      ? { search: searchParams(searching.shown) }
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
  let listKey = $derived(`${pathFor(under)} ${settings.sort} ${searching.shown ? JSON.stringify(searchParams(searching.shown)) : ""}`);

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
  /** An edit screen whose feed, folder or saved search is found: `editor` draws it, as a sheet or (on a phone) a page. */
  let editing = $derived(
    (route.kind === "save-search" && searching.saving !== undefined) ||
      (route.kind === "edit-search" && currentSearch !== undefined) ||
      (route.kind === "edit-feed" && currentFeed !== undefined) ||
      (route.kind === "edit-folder" && currentFolder !== undefined),
  );
  /** A sheet is actually showing (an edit address for a feed, folder or saved search you don't have shows none). */
  let sheetShown = $derived(sheet && (route.kind === "add-feed" || route.kind === "new-to-feeds" || editing));
  /** The feed's, folder's or saved search's name, for the heading and the tab's title. */
  let placeName = $derived(placeNameOf({ feed: currentFeed, folder: currentFolder, search: currentSearch, collection: currentCollection }));
  /** On a saved search, the search field no longer holds what was saved: Escape puts it back. */
  let tweaked = $derived(route.kind === "search" && currentSearch !== undefined && !sameQuery(searching.query, currentSearch.query));
  /** What the screen has found for the place on screen, for the words an empty or missing place shows. */
  let found: Found = $derived({
    feeds: library.feeds !== undefined,
    feed: currentFeed !== undefined,
    folder: currentFolder !== undefined,
    search: currentSearch !== undefined,
    collection: currentCollection !== undefined,
    searchesLoaded: library.searchesLoaded,
    searchesFailed: library.searchesFailed,
    collectionsLoaded: library.collectionsLoaded,
    collectionsFailed: library.collectionsFailed,
  });
  /** A feed, folder, saved search or collection address that names none you have. */
  let missing = $derived(missingFrom(under, found));
  /** The line the list area shows instead of a list, if any. */
  let listInstead = $derived(insteadOfList(under, found));
  /** No feeds yet: Unread and All show the welcome instead (`firstVisit.ts`). */
  let firstVisit = $derived(isFirstVisit(library.feeds));
  let whereWelcome = $derived(welcomeFor({ firstVisit, under, article: panes.article, phone, missing: missing !== undefined }));
  let welcoming = $derived(whereWelcome.shown);
  /** On a computer with the sidebar and the list both hidden, their two buttons become one, which brings both back. */
  let bothHidden = $derived(!phone && !panes.sidebar && !panes.list && isList(route) && !welcoming);
  let welcomeWide = $derived(whereWelcome.wide);
  let welcomeAlone = $derived(whereWelcome.alone);
  /** "New to feeds?" is for the first visit only: once anything is followed, it becomes the home view. */
  $effect(() => {
    if (!newToFeedsGivesWay(route, library.feeds)) return;
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
  /** Add a feed or "New to feeds?" is open (the `task` snippet draws them), and its title. */
  let tasking = $derived(route.kind === "add-feed" || (route.kind === "new-to-feeds" && firstVisit));
  let taskTitle = $derived(route.kind === "add-feed" ? "Add a feed" : "New to feeds?");
  /** The line above the add field, in the sheet and on the phone's page. */
  const ADD_INTRO = "nine turtles finds the feed on any website you like, and lists its articles.";
  /** The list's heading (`listHeading.ts`). */
  let headingText = $derived(headingFor({ under, placeName, missing, results: searching.shown?.scope, names: library.names }));

  /** Keeps the copies for reading offline up to date, in the reader's own order. */
  const keeper = new Keeper(() => void keepUpToDate(settings.sort ?? "newest", settings.mode));

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

  /** The list as its More menu sees it, each time the menu is drawn (`listMenu.ts`). */
  function menuScene(): MenuScene {
    return {
      river,
      searching: searching.shown !== undefined,
      ownOrder: under.kind === "view" && (under.view === "recent" || under.view === "upnext"),
      unread: under.kind === "view" && under.view === "unread",
      selected: selected !== undefined,
      sort: settings.sort,
      savedSearch: under.kind === "search" ? currentSearch?.id : undefined,
      collection: currentCollection,
      feed: currentFeed?.id,
      folder: currentFolder?.id,
    };
  }

  /** What the list's More menu can ask of the screen. */
  const menuHands: MenuHands = {
    shortcut: (kind) => (phone ? undefined : currentKey(kind)),
    markAllRead: () => itemList?.markAllRead(),
    markPast: (side) => itemList?.markPast(side),
    catchUp: () => itemList?.catchUp(),
    refresh: () => itemList?.refresh(),
    changeSort: (next) => settings.changeSort(next),
    say: (message) => itemList?.say(message),
    holdSearch: () => searching.holdForSaving(),
    go: (place) => go(place),
    renameCollection: (collection) => collectionSheets.rename(collection, document.activeElement),
    deleteCollection: (collection) => void removeCollection(collection),
  };

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
    const stopKeeping = keeper.watch();

    const stopWatchingWidth = watchWidth((next) => {
      if (next === layout.width) return;
      const focusWasInside = sidebar?.contains(document.activeElement) ?? false;
      layout.resized(next);
      // If the sidebar just hid with the keyboard's place in it, don't lose that place.
      queueMicrotask(() => {
        if (focusWasInside && !panes.sidebar) afterSidebarHid();
      });
    });

    // The browser's Back and Forward, and on phones the system back gesture.
    const back = () => {
      let next = parse(location.pathname);
      // Back to "Save search" after it was used: there's nothing to save now, so the place it was over.
      if (next.kind === "save-search" && !searching.saving) {
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
        steps.sheetOpenedByBrowser();
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
      keeper.now();
      // This device last saw river mode, but it's inbox now (changed on
      // another device): an untouched home opens on Unread after all.
      if (openedHome && pathFor(route) === pathFor(start) && settings.mode === "inbox" && !(route.kind === "view" && route.view === "unread")) {
        route = { kind: "view", view: "unread" };
        lastPlace = route;
        history.replaceState(history.state, "", pathFor(route));
      }
    });

    return () => {
      searching.stop();
      stopWatchingWidth();
      removeEventListener("popstate", back);
      removeEventListener("keydown", pressed);
      stopWatching();
      stopKeeping();
    };
  });

  /** Where the keyboard's place goes on arriving somewhere (`landing.ts`). */
  function placeFocus(place: Route): HTMLElement | undefined {
    return landingFor(place, headings, { phone, sheetShown, welcome: welcomeWide || welcomeAlone, returnRow });
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
    layout.showHome(screen === "home");
    queueMicrotask(() => {
      if (phone && screen === "home") wordmark?.focus();
      else if (reading) articleHeading?.focus({ preventScroll: true });
      else if (selected && isList(route)) itemList?.focusSelected();
      else focusArriving(route, placeFocus, () => returnRow);
    });
  }

  /** The screen as the reader arranged it, for the new version to open the same way (decision 0085). */
  function carried(next: Route): Carried {
    return {
      keyboard: document.documentElement.dataset.keyboard !== undefined,
      ...layout.carried(),
      lastPlace: pathFor(isList(next) ? next : lastPlace),
      sidebarScroll: sidebar?.querySelector(".scroller")?.scrollTop ?? 0,
    };
  }

  /** Puts back what the page before the switch carried. Feeds and lists arrive a moment later, so it keeps trying for a few seconds. */
  function arriveSwitched(was: Carried) {
    if (was.keyboard) document.documentElement.dataset.keyboard = "";
    layout.putBack(was);
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
    if (move.opening) sheetOpener.remember(document.activeElement);
    steps.goTo(next, from, cameFromSettings, move.opening);
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
    layout.showHome(false);
    if (move.closing && move.sameScreen && sheetOpener.giveBack()) return;
    if (move.closing) sheetOpener.forget();
    queueMicrotask(() => placeFocus(next)?.focus());
  }

  /** Opens a feed's list. */
  function openFeed(id: number) {
    go({ kind: "feed", id });
  }

  async function added(feed: Feed) {
    await loadFeeds();
    openFeed(feed.id);
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
    if (phone && steps.cameFrom("list")) steps.goBack();
    else if (sheetShown) steps.closeSheet();
    else if (route.kind === "edit-feed") openFeed(route.id);
    else if (route.kind === "edit-folder") go({ kind: "folder", id: route.id });
  }

  /** Back from "Save search" or "Edit saved search", saved or not. A new saved search opens. */
  function searchSaved(saved?: SavedSearch) {
    // Used: Back to "Save search" later finds nothing to save, and opens the place it was over.
    searching.saving = undefined;
    if (saved) library.searchSaved(saved);
    if (saved && route.kind === "save-search") {
      go({ kind: "search", id: saved.id });
      return;
    }
    if (phone && steps.cameFrom("list")) steps.goBack();
    else if (sheetShown) steps.closeSheet();
    else if (route.kind === "edit-search") go({ kind: "search", id: route.id });
    else go(lastPlace);
  }

  /** Deletes a saved search (never an article), then shows Unread (All in river mode) with "Deleted … · Undo". */
  async function deleteSearch(saved: SavedSearch): Promise<string | undefined> {
    const done = await library.deleteSearch(saved);
    if (typeof done === "string") return done;
    searching.saving = undefined;
    go(home, done);
    return undefined;
  }

  /** "Add to collection…" or l: the sheet of the reader's collections for this article (decision 0108). */
  function openCollecting(article: Article) {
    collectionSheets.collect(article, document.activeElement);
  }

  /** "Add to collection" closed: a Save that took the article off a collection says so in the list's line, with Undo. */
  function collectingClosed(change?: CollectionChange) {
    const line = collectionSheets.closedCollecting(change, library.collections);
    if (line) itemList?.offer(line.message, line.undo);
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
    if (cameFromSettings) steps.goBack();
    else go(parent);
  }

  /** Close settings, and Escape on Settings or Add a feed: on a phone, back one step to the feeds. */
  function closePage() {
    // "New to feeds?" opens from the welcome on the list's screen: on a phone its X goes back there.
    if (phone && route.kind === "new-to-feeds" && steps.cameFrom("list")) steps.goBack();
    else if (phone) steps.back("home");
    else if (sheetShown) steps.closeSheet();
    else go(lastPlace);
  }

  function toggleSidebar() {
    // On a phone the feeds are the home screen, one step back.
    if (phone) {
      if (!panes.sidebar) steps.back("home");
      return;
    }
    const focusWasInside = sidebar?.contains(document.activeElement) ?? false;
    if (layout.toggleSidebar() && focusWasInside) {
      queueMicrotask(afterSidebarHid);
    }
  }

  /** ] and the list's button: on a computer, hide the article list so the article has its room, or show it again. */
  function toggleList() {
    if (phone || !isList(route)) return;
    const focusWasInside = listSection?.contains(document.activeElement) ?? false;
    if (layout.toggleList() && focusWasInside) queueMicrotask(() => (selected ? articleHeading : listToggle)?.focus());
  }

  /** \: hide the sidebar and the list together, for just the article; pressed again, both come back. */
  function toggleBoth() {
    if (phone || !isList(route)) return;
    const focusWasInside = (sidebar?.contains(document.activeElement) || listSection?.contains(document.activeElement)) ?? false;
    if (layout.toggleBoth() && focusWasInside) queueMicrotask(() => (selected ? articleHeading : listToggle)?.focus());
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
   * j and k, n and Shift+N, Home and End: another article in the list
   * (`moving.ts`). The keyboard's place follows, to the article or its row.
   */
  function move(to: ArticleMove, step: 1 | -1) {
    const focus = moveArticle(itemList, to, step, { ...panes, reading, inArticle: inArticle() });
    if (!focus) return;
    layout.makeWayForArticle();
    if (focus === "row") itemList?.focusSelected();
    else queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
  }

  /** Shift+J and Shift+K: the feed after or before the place you're in, in the sidebar's order. */
  function feedAfter(step: 1 | -1): Route | undefined {
    return nextFeed(library, phone, sidebarFeeds?.openFolders(), route, step);
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
      steps.openArticle();
      reading = true;
    }
    layout.makeWayForArticle();
    queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
  }

  /** "Skip to articles" is offered only while a list of articles is on screen. */
  let skipShown = $derived(isList(route) && panes.list && !welcoming && !missing && !sheetShown);

  /** "Skip to articles": the keyboard goes to the chosen article in the list, or the first; with none, to the list's title. */
  function skipToArticles(event: MouseEvent) {
    event.preventDefault();
    if (!itemList?.focusList()) headings.list?.focus();
  }

  function chose(byKeyboard: boolean) {
    if (phone || byKeyboard) open();
    else layout.makeWayForArticle();
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
      steps.openArticle();
      reading = true;
    }
    layout.makeWayForArticle();
    queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
  }

  // Up Next's list follows only the reader's own changes to it (Move, Remove, Undo, Add), never the removal when
  // an episode starts by itself or by hand: nothing moves unless you move it (principle 5, decision 0113).
  $effect(() => {
    void player.changes;
    untrack(() => {
      if (!searching.shown && under.kind === "view" && under.view === "upnext") void itemList?.refresh();
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
      steps.back("list");
      return;
    }
    if (!panes.list) return;
    itemList?.focusSelected();
  }

  /** Search starts afresh, limited to where you are; on a saved search, as it was saved. */
  function resetSearch() {
    searching.reset(route, savedHere());
  }

  /** The saved search that runs here. `under`: the saved search under its Edit sheet runs too. */
  function savedHere(): SavedSearch | undefined {
    const place = under;
    return place.kind === "search" ? library.searches.find((search) => search.id === place.id) : undefined;
  }

  /** `/`: into the search field, from wherever you are; Escape comes back here. */
  function startSearch() {
    let from: Element | null | undefined;
    if (!isList(route) || (phone && panes.sidebar)) go(lastPlace);
    else if (reading) backToList();
    else from = document.activeElement;
    searching.started(from);
    queueMicrotask(() => searchBar?.focus());
  }

  /** The phone's Search button: shows the field, ready to type in; pressed again with nothing searched, puts it away. */
  function toggleSearch() {
    if (!searching.putAway()) startSearch();
  }

  /** Escape: search closes, the place's own list returns, and the keyboard goes back where it was. */
  function closeSearch() {
    const back = searching.close(route, savedHere());
    queueMicrotask(() => {
      if (back instanceof HTMLElement && back.isConnected && back !== document.body) back.focus();
      else headings.list?.focus();
    });
  }

  function escape() {
    if (parentOf(route)) closeHealth();
    else if (route.kind === "settings" || route.kind === "add-feed" || route.kind === "new-to-feeds") closePage();
    else if (route.kind === "edit-feed" || route.kind === "edit-folder") edited(false);
    else if (route.kind === "save-search" || route.kind === "edit-search") searchSaved();
    else if (reading || (selected && inArticle())) backToList();
    else if (route.kind === "search" ? tweaked || document.activeElement?.closest("search") : searching.open || document.activeElement?.closest("search"))
      closeSearch();
    else if (phone && !panes.sidebar) steps.back("home");
  }

  /** The screen as a shortcut sees it, at the moment of the press (`shortcuts.ts`). */
  function keyScene(): KeyScene {
    return {
      river,
      onList: isList(route),
      searching: searching.shown !== undefined,
      ownOrder: route.kind === "view" && (route.view === "recent" || route.view === "upnext") && !searching.shown,
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
  <Welcome {start} covered={sheet && route.kind === "add-feed"} bind:heading={headings.welcome} bind:field={headings.add} {follow} onAdded={added} onOpen={openFeed} />
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
                bind:this={headings.list}
                title={headingText}
                class="min-w-0 flex-1 truncate font-serif text-heading leading-[1.3] font-semibold tracking-[-0.01em] @max-[340px]:text-[1.375rem]"
              >
                {headingText}
              </h2>
              {#if itemList && !missing}
                <div class="-mr-3 flex shrink-0 items-center">
                  {#if phone}
                    <!-- The way into search, beside More, as an iOS list keeps it (decision 0060). -->
                    <button type="button" aria-label="Search" title="Search" aria-expanded={searching.open} onclick={toggleSearch} class="btn-quiet btn-icon"
                      ><span class="flex size-8 items-center justify-center"><Icon name="search" size={20} /></span></button
                    >
                  {/if}
                  <MoreMenu id="list-menu" groups={listMenu(menuScene(), menuHands)} />
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
<svelte:window bind:innerWidth={layout.windowWidth} />
<!--
  While an episode is in the player, the "now playing" bar takes its own room at the foot (SPEC section 35), so the
  panes above it end where it starts and it never covers them. On a phone reading an article, it sits above the
  article's toolbar instead.
-->
<main class="relative flex h-dvh flex-col overflow-hidden" style:--sidebar-w={`${layout.sidebarPx}px`}>
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
        bind:width={layout.sidebarWidth}
        min={200}
        max={400}
        pane={sidebar}
        onDone={() => layout.storeSidebarWidth()}
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
          bind:heading={headings.settings}
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
        <FeedHealth bind:heading={headings.health} onClose={closeHealth} onFeedsChanged={loadFeeds} besideToggle={!phone && !panes.sidebar} />
      {:else if route.kind === "your-feeds"}
        <YourFeeds
          bind:heading={headings.yourFeeds}
          onClose={closeHealth}
          onOpenFeed={(event, id) => follow(event, { kind: "feed", id })}
          onFeedsChanged={loadFeeds}
          besideToggle={!phone && !panes.sidebar}
        />
      {:else if route.kind === "muted"}
        <Muted bind:heading={headings.muted} onClose={closeHealth} onChanged={loadFeeds} besideToggle={!phone && !panes.sidebar} />
      {:else if route.kind === "readers"}
        <ReadersPage bind:heading={headings.readers} onClose={closeHealth} besideToggle={!phone && !panes.sidebar} />
      {:else if !sheet && editing}
        {@render editor(false)}
      {:else if !sheet && tasking}
        <!-- Keyed as the sheet is, so one task following the other gets a fresh page. -->
        {#key route.kind}
          <section aria-labelledby="list-heading" class="page-sheet">
            <!--
              Only on a phone (wider windows get the sheet). The phone sheet's one build (decisions 0052,
              0055): an iOS page sheet, its grouped ground 10px below the dimmed screen's top with 12px
              top corners, the title with an X that goes back to the feeds (as Escape does), no back
              arrow and no Cancel.
            -->
            <div class="page-sheet-card">
              <PageHead title={taskTitle} bind:heading={headings.list} besideToggle={false} onClose={closePage} closeLabel="Close" />
              <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
                <!-- 20px under the top line as Settings is: Add a feed's line on what to paste, the field, then Add feed the full width at the screen's foot. -->
                <div class="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5">
                  {@render task(false)}
                </div>
              </div>
            </div>
          </section>
        {/key}
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
                : panes.article ? (layout.listPx ? "" : "left-[calc(22rem-3.25rem)] xl:left-[calc(24rem-3.25rem)] 2xl:left-[calc(26rem-3.25rem)]") : "right-2",
            ]}
            style:left={panes.list && panes.article && layout.listPx ? `${layout.listPx - 52}px` : undefined}
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
          style:width={!phone && panes.article && layout.listPx ? `${layout.listPx}px` : undefined}
        >
          {#if !phone && panes.article && !welcomeWide}
            <PaneResizer
              label="Resize the article list"
              bind:width={layout.listWidth}
              min={LIST_MIN}
              max={layout.listMax}
              pane={listSection}
              onDone={() => layout.storeListWidth()}
            />
          {/if}
          {#if phone}
            <!-- The phone's top bar (SPEC section 20): back to the feeds, then the screen's title with More beside it. It never scrolls. -->
            <div class="pane-bar nav-bar">
              <button type="button" onclick={() => steps.back("home")} aria-label="Back to Feeds" class="btn-quiet nav-back"
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
            {#if library.feeds && library.feeds.length > 0 && !missing && (!phone || searching.open)}
              <SearchBar bind:this={searchBar} query={searching.query} feeds={library.feeds} folders={library.folders} collections={library.collections} here={scopeFor(under)} found={listFound} {river} onChange={(next, now) => searching.changed(next, now)} />
            {/if}
            {#if listInstead}
              <p class="mt-4">{listInstead}</p>
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
              {#if under.kind === "feed" && !searching.shown && currentFeed}
                <!-- A feed that isn't working says so above its list, with Find new address (decision 0106). -->
                <FailingLine
                  class="pt-1 pb-2"
                  feed={currentFeed}
                  label="Find its new address"
                  onMoved={(after) => feedMoved(currentFeed!.id, after.id, () => headings.list)}
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
                  empty={searching.shown ? "Nothing found." : emptyText(under)}
                  bold={searching.shown ? searchedTerms(searching.shown.words) : []}
                  onChoose={chose}
                  onUnreadChange={(feedId, change) => library.unreadChanged(feedId, change)}
                  onRefresh={() => {
                    loadFeeds();
                    keeper.refreshed();
                  }}
                  onCounts={loadFeeds}
                  results={searching.shown !== undefined}
                  oneFeed={under.kind === "feed" && !searching.shown}
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
                    onPrevious: () => move("move", -1),
                    onNext: () => move("move", 1),
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

{#if collectionSheets.collecting}
  <AddToCollection article={collectionSheets.collecting} collections={library.collections} onMade={(made) => library.collectionMade(made)} onClose={collectingClosed} />
{:else if collectionSheets.renaming}
  {#key collectionSheets.renaming.id}
    <RenameCollection
      collection={collectionSheets.renaming}
      onSaved={(name) => {
        if (collectionSheets.renaming) library.collectionRenamed(collectionSheets.renaming.id, name);
        collectionSheets.closed();
      }}
      onCancel={() => collectionSheets.closed()}
    />
  {/key}
{/if}

{#if sheet && tasking}
  <!-- Keyed so one task following the other opens a fresh sheet: the keyboard lands again and no form state lingers. -->
  {#key route.kind}
    <Sheet title={taskTitle} bind:heading={headings.sheet} onClose={closePage} initial={route.kind === "add-feed" ? () => headings.add : undefined}>
      {@render task(true)}
    </Sheet>
  {/key}
{:else if sheet && editing}
  {@render editor(true)}
{/if}

<!-- Add a feed and "New to feeds?", drawn once for both places: a sheet over the screen, or on a phone a page in the list's place. -->
{#snippet task(inSheet: boolean)}
  {@const onCancel = inSheet ? closePage : undefined}
  {#if route.kind === "add-feed"}
    <p>{ADD_INTRO}</p>
    <AddFeed bind:field={headings.add} feeds={library.feeds ?? []} onAdded={added} onOpen={openFeed} {onCancel} page={!inSheet} {shared} onShared={() => (shared = "")} />
  {:else}
    <StarterFeeds onAdded={startersAdded} {onCancel} page={!inSheet} />
  {/if}
{/snippet}

<!-- The edit screens, drawn once for both places: a sheet over the screen, or on a phone a page in the list's place. -->
{#snippet editor(inSheet: boolean)}
  {@const at = inSheet ? "sheet" : "list"}
  {@const besideToggle = !inSheet && !phone && !panes.sidebar}
  {#if route.kind === "edit-feed" && currentFeed}
    {#key editKey(currentFeed.id)}
      <EditFeed
        sheet={inSheet}
        feed={currentFeed}
        folders={library.folders}
        bind:heading={headings[at]}
        {besideToggle}
        {river}
        onSaved={() => edited(true)}
        onCancel={() => edited(false)}
        onUnsubscribe={() => unsubscribeFrom(currentFeed!)}
        onAddRule={() => addRuleFor(currentFeed!)}
        onMoved={(after) => feedMoved(currentFeed!.id, after.id, () => headings[at])}
      />
    {/key}
  {:else if route.kind === "edit-folder" && currentFolder}
    {#key currentFolder.id}
      <EditFolder
        sheet={inSheet}
        folder={currentFolder}
        bind:heading={headings[at]}
        {besideToggle}
        onSaved={() => edited(true)}
        onCancel={() => edited(false)}
        onDelete={() => deleteThis(currentFolder!)}
      />
    {/key}
  {:else if route.kind === "save-search" && searching.saving}
    <EditSearch sheet={inSheet} query={searching.saving} library={library.names} bind:heading={headings[at]} {besideToggle} onSaved={searchSaved} onCancel={() => searchSaved()} />
  {:else if route.kind === "edit-search" && currentSearch}
    {#key currentSearch.id}
      <EditSearch
        sheet={inSheet}
        saved={currentSearch}
        query={searching.saving ?? currentSearch.query}
        library={library.names}
        bind:heading={headings[at]}
        {besideToggle}
        onSaved={searchSaved}
        onCancel={() => searchSaved()}
        onDelete={() => deleteSearch(currentSearch!)}
      />
    {/key}
  {/if}
{/snippet}
