<!--
  The signed-in app (SPEC sections 2 to 9, 14 to 16, 18 and 19): the sidebar
  with its search, the folders and feeds and their unread dots, the item
  list with the search field above it (its results take the list's place
  until Escape), and the reading area, one thing at a time (decision 0275), with
  adding a feed, editing feeds and folders, Settings and the `?` shortcut
  list. An article shown in the reading area counts as read. Nothing in it
  moves unless the reader moves it. With Unread off (SPEC section 10) there's
  no Unread view, no dots and no "Mark all as read"; it opens on All.
-->
<script lang="ts">
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import TextButton from "./TextButton.svelte";
  import ListHead from "./ListHead.svelte";
  import ListTop from "./ListTop.svelte";
  import PaneResizer from "./PaneResizer.svelte";
  import { onMount, tick, untrack } from "svelte";
  import AddFeed from "./AddFeed.svelte";
  import FollowPerson from "./FollowPerson.svelte";
  import ArticleView from "./ArticleView.svelte";
  import CheatSheet from "./CheatSheet.svelte";
  import EditFolder from "./EditFolder.svelte";
  import PickUp from "./PickUp.svelte";
  import WhoPage from "./WhoPage.svelte";
  import { placeLabels, placesOf, placesWatch } from "./people";
  import { faceOf } from "./portrait";
  import FailingLine from "./FailingLine.svelte";
  import PausedLine from "./PausedLine.svelte";
  import ItemList from "./ItemList.svelte";
  import type { ListNote } from "./listNote";
  import PageHead from "./PageHead.svelte";
  import Sheet from "./Sheet.svelte";
  import Settings from "./Settings.svelte";
  import YourFeeds from "./YourFeeds.svelte";
  import Welcome from "./Welcome.svelte";
  import Muted from "./Muted.svelte";
  import ReadersPage from "./ReadersPage.svelte";
  import SearchBar from "./SearchBar.svelte";
  import SidebarFeeds from "./SidebarFeeds.svelte";
  import SidebarFoot from "./SidebarFoot.svelte";
  import SidebarViews from "./SidebarViews.svelte";
  import { home as homeDesign, LOOKS } from "./homeStyle.svelte";
  import StarterFeeds from "./StarterFeeds.svelte";
  import { partlyAdded, type Starter } from "./starters";
  import { untitledOpening, type Article, type Feed, type Folder, type Source } from "./shapes";
  import { homeView } from "./reading";
  import { ReadingSettings } from "./reading-settings.svelte";
  import { type Notice } from "./feeds";
  import { marksUnsaved } from "./saving";
  import { keyFor } from "./keyboard";
  import { movePane, moveRow } from "./panes";
  import { listMenu, type MenuHands, type MenuScene } from "./listMenu";
  import { writerItems } from "./rowMenu";
  import { keyListener, type KeyHands, type KeyScene } from "./shortcuts";
  import { currentWidth, ScreenLayout, watchWidth } from "./layout.svelte";
  import { apply, load, save } from "./preferences";
  import { device } from "./appearance.svelte";
  import { addressFor, articleIn, isList, nameFor, ownClick, parentOf, parse, pathFor, sidebarViews, titleFor, type Route } from "./router";
  import { articleAddress, nameAddressesFrom } from "./addressing";
  import { sharedAddress } from "./share";
  import { followTitle } from "./follow";
  import { scopeName, searchParams, searchedTerms } from "./search";
  import { Searching } from "./searching.svelte";
  import { LoadedLibrary } from "./library.svelte";
  import { emptyText, insteadOfList, missingFrom, nothingFound, type Found } from "./listWording";
  import { headingFor, placeNameOf } from "./listHeading";
  import { focusArriving, landingFor, type Headings } from "./landing";
  import { moveArticle, nextInSidebar, type ArticleMove } from "./moving";
  import { isFirstVisit, newToFeedsGivesWay, welcomeFor } from "./firstVisit";
  import { stopTrying, trying } from "./welcomeTry.svelte";
  import { startingStep, stepOf, type Screen } from "./steps";
  import { homeFor, isOver, isWho, listFromOnMove, moveTo, Opener, opensFromHere, Steps, underSheet, whoClosesTo, whoFromOnGo, whoFromOnPop, type ListFrom, type WhoFrom } from "./navigation";
  import { Keeper, keepUpToDate } from "./offline";
  import NowPlaying from "./NowPlaying.svelte";
  import { ADDRESS_GONE, linkItems } from "./articleLinks";
  import { topTapScrolls } from "./topTap";
  import { readArticle } from "./articles";
  import { arrivedBySwitching, settleBack, switchesOnMove, switchTo, updates, watchForNewVersions, type Carried } from "./updates.svelte";

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

  /** Whether Unread is on, and the sort order (reading-settings.svelte.ts). */
  const settings = new ReadingSettings();
  let unreadOff = $derived(!settings.unread);
  /** Where the app opens: Unread, or All with Unread off. */
  let home: Route = $derived({ kind: "view", view: homeView(settings.unread) });
  const parsed = parse(location.pathname);
  const asked: Route = parsed;
  /** The address was "/", Unread or unknown: the app's home, which depends on whether Unread is on. */
  const openedHome = asked.kind === "view" && asked.view === "unread";
  const start = homeFor(asked, untrack(() => settings.unread));
  let route: Route = $state(start);
  /** Where Escape and "Close settings" go back to: the last list you were on. */
  let lastPlace: Route = $state(isList(start) ? start : { kind: "view", view: homeView(untrack(() => settings.unread)) });
  /** A page shared here (/add-feed?url=…, decisions 0104, 0138), read before the address is tidied, for
   * "Follow this person?" (`sharedName`: who it's by); leaving clears it, so Add a feed opens empty after. */
  let shared = $state(parsed.kind === "add-feed" ? sharedAddress(location.search) : "");
  let sharedName = $state("");
  // Home redesign, design round: which version shows, for the sidebar's styles.
  $effect(() => {
    const root = document.documentElement;
    const look = LOOKS[homeDesign.style];
    root.dataset.home = homeDesign.style;
    root.dataset.parts = look?.parts ?? "";
    root.dataset.mark = look?.mark ?? "";
    if (look?.serif) root.dataset.serif = "";
    else delete root.dataset.serif;
  });
  $effect(() => {
    if (route.kind !== "add-feed") untrack(() => (shared = ""));
  });

  // Switching Unread off (here, or on another device) while on Unread moves you to All, in place.
  $effect(() => {
    const next = homeFor(route, settings.unread);
    if (next === route) return;
    untrack(() => {
      route = next;
      if (isList(lastPlace)) lastPlace = homeFor(lastPlace, settings.unread);
      history.replaceState(history.state, "", addressFor(next));
    });
  });
  /** The feeds and folders (library.svelte.ts). */
  const library = new LoadedLibrary();
  /** What's typed in the sidebar search. */
  let search = $state("");
  /** What the next list's line says on arrival (after unsubscribing or deleting a folder). */
  let notice: Notice | undefined = $state();
  let preferences = $state(load());
  /** The article the address opened on names, if any (decision 0233). */
  const fromAddress = articleIn(location.pathname).article;
  /** Which screen this history entry shows (see steps.ts). */
  const firstStep = startingStep(history.state, currentWidth() === "narrow", location.pathname, isList(start));
  let cheatSheetOpen = $state(false);
  /** The article chosen in the list, shown in the reading area. */
  let selected: Article | undefined = $state();
  /** An opened article shows alone: on a computer in the whole window, on a phone in the list's place (decision 0275). */
  let reading = $state(false);
  /** What the search field holds, the search the list shows and the phone's search field (searching.svelte.ts, SPEC section 14). */
  const searching = new Searching(start);
  let searchBar: SearchBar | undefined = $state();

  /** The window's width step, which areas show and the sidebar's dragged width (layout.svelte.ts). */
  const layout = new ScreenLayout(currentWidth(), () => reading, firstStep.screen === "home", (): boolean => whoShown);
  let panes = $derived(layout.panes);
  let phone = $derived(layout.phone);

  let wordmark: HTMLHeadingElement | undefined = $state();
  /** The headings (and the add field) the keyboard's place lands on (`landing.ts`). */
  const headings: Headings = $state({});
  /** "Hide articles about…" on an article or a person's page: Settings › Hiding opens with the field set to them ("Only from …"). */
  let ruleForFeed: number | undefined = $state();
  /** Hidden articles, Readers or one of Settings' own pages was opened from Settings, so closing it is a step back in history. */
  let cameFromSettings = false;
  let whoFrom: WhoFrom = $state(); // Where their page was opened from (decision 0284).
  let listFrom: ListFrom = $state(); // Their list opened from an article's byline: "‹ Article" goes back to it (decision 0289).
  let cameBackFrom: number | undefined = $state(); // Everyone you follow, back from their page: the keyboard goes back to their row.
  /** Back from a page opened from Settings: the row on its parent page that opened it, for the keyboard to return to (decision 0120). */
  let returnRow: string | undefined;
  let sidebar: HTMLElement | undefined = $state();
  let articleHeading: HTMLHeadingElement | undefined = $state();
  let itemList: ItemList | undefined = $state();
  let articleView: ArticleView | undefined = $state();
  let sidebarFeeds: SidebarFeeds | undefined = $state();
  /** Home redesign, design round: the sidebar's Edit, which bold shows beside the wordmark. */
  let homeEditing = $state(false);
  /** Edit put someone in folders just made or chosen: they open in the sidebar, or stay open for when it shows (point 14). */
  const showFolders = (ids: number[]) => library.setOpen([...new Set([...library.openFolders, ...ids])]);
  /** The list's note, drawn in the reading area while the list isn't on screen (decision 0229). */
  let listNote: ListNote | undefined = $state();

  /**
   * On a window wide enough for the list, the short tasks (adding a feed, editing a folder,
   * "New to feeds?"; `isOver`) open as a sheet over the place you were, which stays in view.
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
        : { view: under.kind === "view" ? under.view : homeView(settings.unread) },
  );
  /** The list's identity: a new one is loaded when it changes. */

  let currentFeed = $derived.by(() => {
    const place = isWho(route) ? route : under;
    return place.kind === "feed" || isWho(place) ? library.feeds?.find((feed) => feed.id === place.id) : undefined;
  });
  /** A person's or publication's page, or their settings, is showing (decisions 0163, 0267): alone in the window, or on a phone in the list's place. */
  let whoShown = $derived(isWho(route) && currentFeed !== undefined && library.feeds !== undefined);
  // Addresses carry the sidebar's names (decision 0281): once it has loaded, an old or nameless address is tidied, an open article's part kept.
  nameAddressesFrom(library);
  $effect(() => {
    const { list } = articleIn(location.pathname);
    if (library.rows && "id" in route && list !== addressFor(route)) untrack(() => history.replaceState(history.state, "", addressFor(route) + location.pathname.slice(list.length)));
  });
  /** The places of the person on screen (SPEC section 36): just the place, for one on its own. */
  let currentPlaces = $derived(currentFeed && library.feeds ? placesOf(currentFeed, library.feeds) : []);
  // A person's places joined or parted: their list refreshes in place, keeping its line and Undo.
  const placesChanged = placesWatch();
  $effect(() => void (placesChanged(currentFeed?.id, currentPlaces.length) && untrack(() => itemList?.refresh())));
  let currentFolder = $derived.by(() => {
    const place = under.kind === "folder" ? under : route;
    return place.kind === "folder" || place.kind === "edit-folder"
      ? library.folders.find((folder) => folder.id === place.id)
      : undefined;
  });
  /** An edit screen whose folder is found: `editor` draws it, as a sheet or (on a phone) a page. */
  let editing = $derived(route.kind === "edit-folder" && currentFolder !== undefined);
  /** A sheet is actually showing (an edit address for a folder you don't have shows none). */
  let sheetShown = $derived(sheet && (route.kind === "add-feed" || route.kind === "new-to-feeds" || editing));
  let listKey = $derived(`${pathFor(under)} ${settings.sort} ${searching.shown ? JSON.stringify(searchParams(searching.shown)) : ""}`);
  /** The feed's or folder's name, for the heading and the tab's title. */
  let placeName = $derived(placeNameOf({ feed: library.shownAs(currentFeed), folder: currentFolder }));
  /** What the screen has found for the place on screen, for the words an empty or missing place shows. */
  let found: Found = $derived({
    feeds: library.feeds !== undefined,
    feed: currentFeed !== undefined,
    folder: currentFolder !== undefined,
  });
  /** A feed or folder address that names none you have. */
  let missing = $derived(missingFrom(under, found));
  /** The line the list area shows instead of a list, if any. */
  let listInstead = $derived(insteadOfList(under, found));
  /** No feeds yet: Unread and All show the welcome instead (`firstVisit.ts`). */
  let firstVisit = $derived(isFirstVisit(library.feeds));
  let whereWelcome = $derived(welcomeFor({ firstVisit: firstVisit || !!trying.current, under, phone, missing: missing !== undefined }));
  let welcoming = $derived(whereWelcome.shown);
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
  /** Add a feed or "New to feeds?" is open (the `task` snippet draws them), and its title. */
  let tasking = $derived(route.kind === "add-feed" || (route.kind === "new-to-feeds" && firstVisit));
  /** Who Add just found, while it asks whether they're a person or a publication: the sheet's title asks about them. */
  let foundName = $state("");
  let taskTitle = $derived(route.kind === "add-feed" ? (shared ? followTitle(sharedName) : foundName ? `${foundName} is…` : "Add a person or publication") : "New to feeds?");
  /** The list's heading (`listHeading.ts`). */
  let headingText = $derived(headingFor({ under, placeName, missing, results: searching.shown?.scope, names: library.names }));

  /** Keeps the copies for reading offline up to date, in the reader's own order. */
  const keeper = new Keeper(() => void keepUpToDate(settings.sort ?? "newest", settings.unread));

  const loadFeeds = () => library.loadFeeds(); // Loads the feeds and folders.
  // A phone opens on the welcome while you follow no one (decision 0137); Back goes home. Only on opening: feeds arriving after a move change nothing.
  $effect(() => void (firstVisit && untrack(() => !layout.moved && phone && screenNow() === "home" && isList(route) && go(route))));
  $effect(() => (phone ? topTapScrolls() : undefined)); // Tapping the top of an iPhone's screen scrolls to the top (decision 0237).

  $effect(() => {
    // device.dark: "Match device" follows the device's own switch while nine turtles is open.
    apply(preferences, document.documentElement, device.dark);
    save(preferences);
  });

  $effect(() => {
    // While an article is open the tab names it, as every website does (decision 0231).
    const open = selected && reading ? selected.title.trim() || untitledOpening(selected) : undefined;
    document.title = shared ? `${taskTitle} · nine turtles` : titleFor(route, placeName, open);
    // And the address names it, under its list (decision 0233), so reload, Back and bookmarks keep it.
    const address = selected && open !== undefined ? articleAddress(selected, route, library.rows) : addressFor(route);
    if (isList(route) && location.pathname !== address) history.replaceState(history.state, "", address);
  });

  // Where you are is always in sight in the sidebar (SPEC section 5): when the place changes, its row scrolls just far enough
  // to show, at once (decision 0051); not when the counts change, so nothing moves unless you move it. The phone's feeds screen marks no place.
  let sidebarPlace = $derived(!phone && panes.sidebar && library.feeds !== undefined ? pathFor(route) : "");
  $effect(() => {
    if (sidebarPlace === "") return;
    untrack(() => {
      const row = sidebar?.querySelector(".scroller [aria-current='page']");
      row?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });
  });

  // An article counts as read once it's open (SPEC section 8), never while their page has the window; only a newly shown one, so `m` on it keeps it unread until you move away and back.
  let lastShown: number | undefined;
  $effect(() => {
    const showing = reading && !whoShown ? selected : undefined;
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
      unreadOff,
      searching: searching.shown !== undefined,
      sort: settings.sort,
      feed: currentFeed?.id,
      feedName: placeName,
      folder: currentFolder?.id,
    };
  }

  /** What the list's More menu can ask of the screen. */
  const menuHands: MenuHands = {
    shortcut: (kind) => (phone ? undefined : keyFor(kind)),
    markAllRead: () => itemList?.markAllRead(),
    refresh: () => itemList?.refresh(true),
    changeSort: (next) => settings.changeSort(next),
    say: (message) => itemList?.say(message),
    go: (place) => go(place),
  };

  onMount(() => {
    // "/" and unknown addresses open Unread (All with Unread off); the address bar says so.
    history.replaceState(firstStep, "", addressFor(route));
    openAddressed(fromAddress);

    // Arriving here by switching to a new version: the screen is as the reader left it, and the
    // keyboard's place goes to the heading, as going here without the switch would have done.
    const switched = arrivedBySwitching();
    if (switched) arriveSwitched(switched);
    const stopWatching = watchForNewVersions();
    // Reading offline (SPEC section 32): the copies on this device are brought
    // up to date once the settings are known (below), when the connection
    // comes back, and when nine turtles comes back into view after a while.
    const stopKeeping = keeper.watch();

    const stopWatchingWidth = watchWidth((next) => {
      if (next !== layout.width) layout.resized(next);
    });

    // The browser's Back and Forward, and on phones the system back gesture.
    const back = () => {
      const next = parse(location.pathname);
      // Back or Forward onto a page opened from its parent: closing it is a step back again.
      cameFromSettings = stepOf(history.state)?.fromParent === true;
      whoFrom = whoFromOnPop(whoFrom, route, next, !!hidingFrom);
      listFrom = listFromOnMove(listFrom, next, stepOf(history.state)?.screen === "article");
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
      stopTrying(); // Back and Forward end the welcome's "Or try one" too (decision 0198).
      if (isList(route)) lastPlace = route;
      if (!move.keepsArticle) {
        selected = undefined;
        resetSearch();
      }
      if (move.closing && sheetOpener.giveBack()) return;
      arrive(stepOf(history.state)?.screen ?? (isList(route) ? "list" : "page"));
      openAddressed(articleIn(location.pathname).article); // Back onto an article left for another place opens it again (decision 0233).
    };
    addEventListener("popstate", back);

    const pressed = keyListener(() => sheetShown, keyScene, keyHands); // Settings' own sheets are asked of the page.
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
    void settings.load().then(() => {
      keeper.now();
      // This device last saw Unread off, but it's on now (changed on
      // another device): an untouched home opens on Unread after all.
      if (openedHome && pathFor(route) === pathFor(start) && settings.unread && !(route.kind === "view" && route.view === "unread")) {
        route = { kind: "view", view: "unread" };
        lastPlace = route;
        history.replaceState(history.state, "", addressFor(route));
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
    reading = screen === "article" && selected !== undefined;
    layout.showHome(screen === "home");
    if (phone && screen === "home") void library.catchUp(); // The feeds screen's dots catch up as you arrive on it (SPEC section 13).
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
      lastPlace: pathFor(isList(next) ? next : lastPlace),
      sidebarScroll: sidebar?.querySelector(".scroller")?.scrollTop ?? 0,
    };
  }

  /** Puts back what the page before the switch carried. Feeds and lists arrive a moment later, so it keeps trying for a few seconds. */
  function arriveSwitched(was: Carried) {
    if (was.keyboard) document.documentElement.dataset.keyboard = "";
    const place = parse(was.lastPlace);
    if (isList(place) && !isList(route)) lastPlace = place;
    settleBack(() => placeFocus(route), wordmark, () => sidebar?.querySelector(".scroller"), was.sidebarScroll);
  }

  /** Goes to a place, and moves the keyboard's place to its heading (unless `focus` is false). A list arrived at with a `withNotice` shows it in its line, with Undo. */
  function go(next: Route, withNotice?: Notice, focus = true) {
    const move = moveTo({ route, under, phone }, next);
    // A newer nine turtles is live: going somewhere else redraws the screen
    // anyway, so arrive there in the new version (decision 0085).
    if (!move.keepsArticle && switchesOnMove(updates.ready, marksUnsaved(), !!withNotice)) {
      switchTo(addressFor(next), carried(next));
      return;
    }
    const from = screenNow();
    stopTrying(); // Going anywhere ends the welcome's "Or try one" (decision 0198).
    cameFromSettings = opensFromHere(route, next);
    whoFrom = whoFromOnGo(whoFrom, route, next, reading && !!selected, !!hidingFrom);
    listFrom = listFromOnMove(listFrom, next);
    cameBackFrom = isWho(route) && next.kind === "your-feeds" && !withNotice ? route.id : undefined;
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
    // On a phone-narrow window the sidebar is the home screen; choosing a
    // place shows it instead.
    layout.showHome(false);
    if (move.closing && move.sameScreen && sheetOpener.giveBack()) return;
    if (move.closing) sheetOpener.forget();
    if (focus) queueMicrotask(() => placeFocus(next)?.focus());
  }

  const openFeed = (id: number) => go({ kind: "feed", id }); // Opens a feed's list.

  /** The writer's name under an article's title: their list, with "‹ Article" back to it (decision 0289). */
  const openWriter = (row: number, article = selected, list = route) => (go({ kind: "feed", id: row }), article && (listFrom = { row, article, list }));
  /** "‹ Article" (and Escape): a step back in history to the article, open where it was; or, if that step isn't there (their page opened and closed since), the article again in the list it was read in. */
  function backToArticle(from = listFrom) {
    listFrom = undefined;
    if (steps.cameFrom("article")) steps.goBack();
    else if (from) (go(from.list), openFromOutside(from.article, true));
  }

  async function added(feed: Feed, note?: string) {
    const stay = route.kind !== "add-feed" && !firstVisit && !trying.current; // Add a feed closed while still looking: the feed only joins the sidebar.
    await loadFeeds();
    if (!stay) go({ kind: "feed", id: library.rowOf(feed.id) }, library.followed(feed, (back) => go(home, back), note)); // As one person, if several were followed together.
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

  /** Back from Edit folder, saved or not, to the folder. */
  async function edited(saved: boolean) {
    if (saved) await loadFeeds();
    // On a phone the edit page is a step on from its list: go back that step.
    if (phone && steps.cameFrom("list")) steps.goBack();
    else if (sheetShown) steps.closeSheet();
    else if (route.kind === "edit-folder") go({ kind: "folder", id: route.id });
  }

  /** Unsubscribes, then shows "Unsubscribed from … · Undo" on Everyone you follow if their page came from there, else on Unread. */
  async function unsubscribeFrom(feed: Feed, removeKept = false): Promise<string | undefined> {
    const done = await library.unsubscribe(feed, removeKept);
    if (typeof done === "string") return done;
    go(whoFrom === "following" ? { kind: "your-feeds" } : home, done);
    return undefined;
  }

  /** Deletes a folder (never its feeds), then shows Unread (All with Unread off) with "Deleted … · Undo". */
  async function deleteThis(folder: Folder): Promise<string | undefined> {
    const done = await library.deleteFolder(folder);
    if (typeof done === "string") return done;
    go(home, done);
    return undefined;
  }

  /** "This is one person" on a folder (SPEC section 36): its places become one person; their list, with "… · Undo". */
  async function personFrom(folder: Folder): Promise<string | undefined> {
    const done = await library.folderToPerson(folder);
    return typeof done === "string" ? done : void go({ kind: "feed", id: done.lead }, done);
  }

  const follow = (event: MouseEvent, next: Route) => ownClick(event) && go(next); // A click meant for a new tab or window is the browser's.

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
      if (after !== before) go(isWho(route) ? { ...route, id: library.rowOf(after) } : { kind: "feed", id: after });
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

  function hideFrom(feed: number) { // "Hide articles about…" (an article's More menu, a person's page): Settings › Hiding, with the field set to them ("Only from …").
    ruleForFeed = feed;
    hidingFrom = isWho(route) ? { route, name: library.shownAs(currentFeed)?.title ?? currentFeed?.title ?? "Back" } : undefined;
    go({ kind: "settings", page: "hiding" });
  }
  /** Their page, when it opened Hiding: Hiding's way back leads there ("‹ Jim Nielsen"), not to Settings (decision 0254). */
  let hidingFrom: { route: Route; name: string } | undefined = $state();
  $effect(() => void ((route.kind === "settings" && route.page === "hiding") || (hidingFrom = undefined)));

  /** Closes a page opened from Settings (its own pages, decision 0120) or their settings (decision 0267), or Escape there: back to that page, a step back when it came from there. */
  function closeSettingsPage() {
    if (hidingFrom) return go(hidingFrom.route);
    const parent = parentOf(route);
    if (!parent) return;
    if (cameFromSettings) steps.goBack();
    else go(parent);
  }

  /** × on their page (Escape, and ‹ on a phone): back where it was opened from (`whoClosesTo`). */
  const closeWho = () => isWho(route) && ((to) => (to === "back" ? steps.goBack() : go(to, undefined, to.kind !== "your-feeds")))(whoClosesTo(whoFrom, route));

  /** Close settings, and Escape on Settings or Add a feed: on a phone, back one step to the feeds. */
  function closePage() {
    // "New to feeds?" opens from the welcome on the list's screen: on a phone its X goes back there.
    if (phone && route.kind === "new-to-feeds" && steps.cameFrom("list")) steps.goBack();
    else if (phone) steps.back("home");
    else if (sheetShown) steps.closeSheet();
    else go(lastPlace);
  }

  /** Is the keyboard's place in the reading area? */
  function inArticle(): boolean {
    return articleHeading?.closest("section")?.contains(document.activeElement) ?? false;
  }

  /** j and k, Home and End: another article in the list (`moving.ts`). The keyboard's place follows, to the article or its row. */
  function move(to: ArticleMove, step: 1 | -1) {
    const focus = moveArticle(itemList, to, step, { ...panes, reading, inArticle: inArticle() });
    if (!focus) return;
    if (focus === "row") itemList?.focusSelected();
    else queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
  }

  /** Shift+J and Shift+K: the row after or before the place you're in, in the sidebar's order. */
  function rowAfter(step: 1 | -1): Route | undefined {
    return nextInSidebar({ feeds: library.rows, folders: library.folders }, sidebarViews(unreadOff), phone, sidebarFeeds?.openFolders(), route, step);
  }

  /** Enter and o: open the selected article (the first, if none is selected yet) to read. */
  function open() {
    if (!itemList || (!panes.list && !panes.article && !reading)) return;
    if (!selected && !itemList.move(1)) return;
    if (!reading) {
      // The article is a screen of its own, one step on (decision 0275).
      steps.openArticle();
      reading = true;
    }
    queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
  }

  /** "Skip to articles" is offered only while a list of articles is on screen. */
  let skipShown = $derived(isList(route) && panes.list && !welcoming && !missing && !sheetShown);

  /** "Skip to articles": the keyboard goes to the chosen article in the list, or the first; with none, to the list's title. */
  function skipToArticles(event: MouseEvent) {
    event.preventDefault();
    if (!itemList?.focusList()) headings.list?.focus();
  }


  /**
   * Opens an article from outside the list (the "now playing" bar, SPEC 35; where you left off, SPEC 7): its feed's list
   * opens with it chosen, keyboard on it. `here`: from the address, in the list it names (decision 0233).
   */
  function openFromOutside(article: Article, here = false) {
    if (selected?.id !== article.id) {
      if (!here && !(isList(route) && route.kind === "feed" && route.id === article.feedId)) go({ kind: "feed", id: article.feedId });
      selected = article;
    }
    if (!reading) {
      if (!here || stepOf(history.state)?.screen !== "article") steps.openArticle(); // A reloaded article is its step already.
      reading = true;
    }
    queueMicrotask(() => articleHeading?.focus({ preventScroll: true }));
  }

  /** An address naming an article opens it in its list (decision 0233), or says why not; the address names it again once open. */
  function openAddressed(id: number | undefined) {
    if (!id || selected?.id === id || !isList(route)) return;
    void readArticle(id).then((article) => selected ?? openFromOutside(article, true), () => (notice = { message: ADDRESS_GONE }));
  }

  /** An article's own address, under the list on screen (decision 0233). */
  const addressOf = (article: Article) => articleAddress(article, isList(route) ? route : under, library.rows);

  /** Back from the article to its row in the list. */
  function backToList() {
    if (reading) steps.back("list");
    else if (panes.list) itemList?.focusSelected();
  }

  /** Search starts afresh, limited to where you are. */
  function resetSearch() {
    searching.reset(route);
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

  /** "Search articles for …" under the sidebar's search, or Enter in it (decision 0231): those words, in All articles. */
  function searchArticles(words: string) {
    if (words === "") return;
    search = "";
    go({ kind: "view", view: "all" });
    searching.wordsEverywhere(words);
    tick().then(() => searchBar?.focus());
  }

  /** The list's Search button: shows the field, ready to type in; pressed again with nothing searched, puts it away. */
  function toggleSearch() {
    if (!searching.putAway()) startSearch();
  }

  /** Escape: search closes, the place's own list returns, and the keyboard goes back where it was. */
  function closeSearch() {
    const back = searching.close(route);
    queueMicrotask(() => {
      if (back instanceof HTMLElement && back.isConnected && back !== document.body) back.focus();
      else headings.list?.focus();
    });
  }

  function escape() {
    if (parentOf(route)) closeSettingsPage();
    else if (route.kind === "settings" || route.kind === "add-feed" || route.kind === "new-to-feeds") closePage();
    else if (route.kind === "edit-folder") edited(false);
    else if (isWho(route)) closeWho();
    else if (reading || (selected && inArticle())) backToList();
    else if (searching.open || document.activeElement?.closest("search")) closeSearch();
    else if (listFrom) backToArticle();
    else if (phone && !panes.sidebar) steps.back("home");
  }

  /** The screen as a shortcut sees it, at the moment of the press (`shortcuts.ts`). */
  function keyScene(): KeyScene {
    return {
      unreadOff,
      onList: isList(route),
      searching: searching.shown !== undefined,
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
      writer: selected && library.feeds?.some((feed) => feed.id === selected?.feedId) ? library.rowOf(selected.feedId) : undefined,
      textSize: preferences.textSize,
    };
  }

  /** What a shortcut can ask of the screen. */
  const keyHands: KeyHands = {
    openCheatSheet: () => (cheatSheetOpen = true),
    go: (place) => go(place),
    escape, startSearch, move, rowAfter, open, movePane, moveRow,
    openLink: (link) => window.open(link, "_blank", "noopener,noreferrer"),
    page: (step) => articleView?.page(step),
    copyLink: () => articleView?.copyLink(),
    markAllRead: () => itemList?.markAllRead(),
    toggleFolder: (id) => sidebarFeeds?.toggleFolder(id),
    star: () => itemList?.toggleStar(),
    inArticle: (what) => articleView?.act(what),
    markUnread: () => itemList?.markUnread(),
    undo: () => itemList?.undo(), needsArticle: () => itemList?.needsArticle(),
    refresh: () => itemList?.refresh(true),
    setTextSize: (size) => (preferences.textSize = size),
  };
</script>

{#snippet welcome(start: boolean)}
  <Welcome {start} covered={sheet && route.kind === "add-feed"} bind:heading={headings.welcome} bind:field={headings.add} {follow} onAdded={added} onOpen={openFeed} onImported={(message) => (go(home, { message }), loadFeeds())} onTried={loadFeeds} />
{/snippet}

<!--
  The whole app is the page's main content; the sidebar and areas inside are its named parts.
  It is exactly the window's height and never lets anything out: only the areas inside scroll,
  each on its own, so the page itself never moves (a hidden screen-reader line once stretched it).
  So every scrolling area here and in the screens it shows is `relative`: it holds its own hidden
  lines. A new scrolling area needs the same, and any new bar must sit inside an area, not beside it.
-->
<!-- Coming back to the app on the phone's feeds screen: its dots catch up as it opens (SPEC section 13). -->
<svelte:document onvisibilitychange={() => !document.hidden && phone && panes.sidebar && library.catchUp()} />
<!-- While an episode plays, the "now playing" bar takes its own room at the foot, never covering the panes; on a phone reading, above the toolbar (SPEC 35). -->
<main class="reading-width relative flex h-dvh flex-col overflow-hidden" style:--sidebar-w={`${layout.sidebarPx}px`}>
  {#if skipShown}
    <!-- First in the Tab order (SPEC section 19), out of sight until the keyboard reaches it: past the sidebar to the chosen article, or the first. -->
    <a href="#list-pane" class="skip-link" onclick={skipToArticles}>Skip to articles</a>
  {/if}
  <div class="relative flex min-h-0 flex-1 overflow-hidden">
  {#if !panes.sidebar}
    <!-- The wordmark is the page's main heading; with the sidebar away (an article, a person's page), screen readers still find it. -->
    <h1 class="sr-only">nine turtles</h1>
  {/if}
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
    <div class={["pane-bar gap-4 pl-5", phone ? "pr-4" : "pr-5"]}>
        <!-- A name, not a control: never a Tab stop; the keyboard lands here only when the screen opens (decision 0041). -->
        <h1 class={["wordmark mr-auto font-serif font-semibold tracking-[-0.01em]", phone ? "text-wordmark-phone" : "text-wordmark leading-[1.35] text-ink-2"]} tabindex="-1" bind:this={wordmark}>nine turtles</h1>
        {#if LOOKS[homeDesign.style]?.editTop && library.folders.length > 0 && !search.trim()}
          <!-- Home redesign, bold: no headings, so Edit (arranging Home) sits at the top, as iOS puts a list's Edit. -->
          <button type="button" class="btn-quiet shrink-0 rounded-press px-3 text-meta text-ink-2 min-h-8 pointer-coarse:min-h-11" aria-pressed={homeEditing} onclick={() => (homeEditing = !homeEditing)}>{homeEditing ? "Done" : "Edit"}</button>
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
        <span class="pointer-events-none absolute top-0 left-3 flex h-(--search-height) w-4 items-center justify-center text-muted"><Icon name="search" /></span>
        <label for="sidebar-search" class="sr-only">Find a person or folder</label>
        <input
          id="sidebar-search" dir="auto"
          type="search"
          bind:value={search}
          placeholder="Find a person or folder"
          autocomplete="off"
          onkeydown={(event) => {
            // Escape empties the search first; pressed again, it does what it does elsewhere.
            if (event.key === "Escape" && search !== "") {
              event.preventDefault();
              search = "";
            }
            if (event.key === "Enter" && !event.isComposing) searchArticles(search.trim());
          }}
          class="search-capsule w-full pr-3 pl-10"
        />
      </div>
      {/if}
      {#snippet yours()}<SidebarViews {route} {follow} {phone} {unreadOff} {welcoming} part="yours" />{/snippet}
      <SidebarViews {route} {follow} {phone} {unreadOff} {welcoming} waiting={!!library.feeds?.some((feed) => feed.unread > 0)} part={homeDesign.style === "now" ? "every" : "top"} />
      {#if library.feeds}
        <SidebarFeeds
          yours={homeDesign.style === "now" ? undefined : yours}
          bind:this={sidebarFeeds}
          bind:editing={homeEditing}
          {library}
          {route}
          {search}
          {follow}
          {phone}
          {unreadOff}
          {searchArticles} onLeft={(row, kept) => { const places = row.places ?? [row.id]; if ((route.kind === "feed" || isWho(route)) && places.includes(route.id)) go(home); else itemList?.letGo(places, kept); }} onBack={() => itemList?.refresh()} onLink={(address) => { shared = address; go({ kind: "add-feed" }); }}
        />
      {/if}
      {#if library.feedsFailed}
        <p role="status" class="flex flex-wrap items-center gap-x-2 px-4 pt-4 text-meta">Your feeds couldn't be loaded.<TextButton onclick={() => loadFeeds().then(() => document.querySelector<HTMLElement>("#sidebar a")?.focus())}>Try again</TextButton></p>
      {/if}
      {#if homeDesign.style !== "now" && !search.trim()}
        <SidebarViews {route} {follow} {phone} {unreadOff} {welcoming} part="everyone" />
      {/if}
    </div>
    <SidebarFoot {route} {follow} {phone} bind:keysOpen={cheatSheetOpen} />
    {#if !phone && panes.list}
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
          onBack={closeSettingsPage} backTo={hidingFrom?.name}
          bind:preferences
          loaded={settings.sort !== undefined}
          unread={settings.unread}
          onUnread={(next) => settings.changeUnread(next)} replies={settings.replies} onReplies={(next) => settings.changeReplies(next)}
          bind:heading={headings.settings}
          {version}
          {owner}
          {email}
          {emailSending}
          {passkeys}
          {onSignedOut}
          onClose={closePage}
          onImported={loadFeeds}
          onMuted={(event) => follow(event, { kind: "muted" })}
          onReaders={(event) => follow(event, { kind: "readers" })}
          people={library.rows ?? []}
          {phone}
          bind:ruleForFeed
        />
      {:else if route.kind === "your-feeds"}
        <YourFeeds
          bind:heading={headings.yourFeeds}
          onBack={phone ? () => steps.back("home") : undefined}
          onOpenPerson={(event, id) => follow(event, { kind: "about", id: library.rowOf(id) })}
          onFeedsChanged={loadFeeds}
          {notice}
          returnTo={cameBackFrom}
        />
      {:else if route.kind === "muted"}
        <Muted bind:heading={headings.muted} onClose={closeSettingsPage} onChanged={loadFeeds} />
      {:else if route.kind === "readers"}
        <ReadersPage bind:heading={headings.readers} onClose={closeSettingsPage} />
      {:else if !sheet && editing}
        {@render editor(false)}
      {:else if whoShown && phone}
        {@render who()}
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
              <PageHead title={taskTitle} bind:heading={headings.list} onClose={closePage} closeLabel="Close" />
              <div use:edge class="scroller relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-5 md:px-10">
                <!-- 20px under the top line as Settings is: + Add's line on what to paste, the field, then Add the full width at the screen's foot. -->
                <div class="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5">
                  {@render task(false)}
                </div>
              </div>
            </div>
          </section>
        {/key}
      {:else}
        <section
          aria-labelledby="list-heading"
          id="list-pane"
          hidden={!panes.list || welcomeWide}
          class={[
            // A container, so the list's title can step down a size when the pane is narrow (decision 0041).
            "list-pane relative @container flex-col bg-paper",
            // On a computer its rows sit in the column an article's text will (`list-column.css`, decision 0277).
            "min-w-0 flex-1", phone && "phone",
            panes.list && !welcomeWide && "flex",
          ]}
        >
          <ListTop {phone} titleHidden={welcomeAlone} toArticle={listFrom && (() => backToArticle())} onHome={() => steps.back("home")}>
            <ListHead text={headingText} actions={!!itemList && !missing} searchOpen={searching.open} onSearch={toggleSearch} menu={() => listMenu(menuScene(), menuHands)} bind:heading={headings.list}
              onAbout={currentFeed && under.kind === "feed" && !searching.shown && !missing ? () => go({ kind: "about", id: currentFeed!.id }) : undefined} face={currentFeed && faceOf(currentFeed, currentPlaces)} />
          </ListTop>
          <!-- A column, so the floating note can sit at the pane's foot even under a short list. -->
          <div use:edge class="scroller relative flex min-h-0 flex-1 scroll-pb-24 flex-col overflow-y-auto pt-2 pr-[var(--list-end)] pb-6 pl-[var(--list-start)]">
            {#if library.feeds && library.feeds.length > 0 && !missing && searching.open}
              <SearchBar bind:this={searchBar} query={searching.query} feeds={library.rows ?? []} folders={library.folders} onChange={(next, now) => searching.changed(next, now)} />
            {/if}
            {#if listInstead}
              <p class="mt-4">{listInstead}</p>
            {:else if welcomeWide}
              <!-- On a computer the welcome has the list's room and owns the screen (below): the list stays empty, saying nothing (decision 0041). -->
            {:else if welcoming}
              <!--
                On a phone, or where the address names nothing, the welcome is here. On a phone the list's title steps aside (screen
                readers still hear it), so one heading shows: the welcome's, 96px under the top line on the screen's margin (decision
                0052), out of the list's 28px dot gutter (decision 0054) to the 20px margin. A computer keeps it centred.
              -->
              <div class={phone ? "mt-24 ml-[calc(1.25rem-var(--list-start))] flex" : "mt-8 flex justify-center"}>{@render welcome(phone)}</div>
            {:else if library.feeds !== undefined && settings.sort !== undefined}
              {#if !searching.shown}<PickUp class="pt-1 pb-3" screen={screenNow() === "list" ? pathFor(under) : screenNow()} onOpen={openFromOutside} />{/if}
              {#if under.kind === "feed" && !searching.shown && currentFeed}
                <!-- A feed that isn't working says so above its list, with Find new address (decision 0106); a paused one, with Resume (decision 0239). -->
                <FailingLine class="pt-1 pb-2" feed={currentFeed} onMoved={(after) => feedMoved(currentFeed!.id, after.id, () => headings.list)} />
                {#key currentFeed.id}<PausedLine class="pt-1 pb-2" places={currentPlaces} {library} onResumed={() => itemList?.refresh()} />{/key}
              {/if}
              <!-- The list, with "New articles · press r" and Undo in a note floating at its foot (More, with Refresh, sits beside the title). -->
              {#key listKey}
                <ItemList
                  bind:this={itemList} bind:note={listNote}
                  bind:selected
                  {source} place={headingText} checking={library.checking} onChecking={loadFeeds} sorted={library.sorted && { counts: library.sorted, onLookOver: () => (library.closeSorted(), go({ kind: "your-feeds" })), onClose: () => library.closeSorted() }}
                  order={settings.sort}
                  {notice}
                  empty={searching.shown ? nothingFound(searching.shown.words, scopeName(searching.shown.scope, library.names), searching.shown.scope.kind === "all" ? undefined : () => (searching.everywhere(), queueMicrotask(() => searchBar?.focus()))) : emptyText(under, currentFeed?.checkedAt ?? null)}
                  bold={searching.shown ? searchedTerms(searching.shown.words) : []}
                  onChoose={open}
                  onUnreadChange={(feedId, change) => library.unreadChanged(feedId, change)}
                  onRefresh={() => (loadFeeds(), keeper.refreshed())}
                  results={searching.shown !== undefined}
                  oneFeed={under.kind === "feed" && !searching.shown && placeLabels(currentPlaces)}
                  {unreadOff}
                  rowActions={(article) => [
                    { items: writerItems(article, library, { go, writeBack: (it) => ((selected = it), open(), void tick().then(() => articleView?.act("write-back"))) }) },
                    { items: linkItems(article, addressOf(article), (message) => itemList?.inform(message)) },
                  ]}
                  {addressOf}
                />
              {/key}
            {/if}
          </div>
        </section>
        {#if welcomeWide && panes.list}
          <!-- No feeds yet, on a computer: the welcome has the list's room beside the sidebar (SPEC section 2), its heading still 28% down as what's under the field grows (decision 0206). -->
          <section aria-labelledby="welcome-heading" class="flex min-w-0 flex-1 flex-col items-center overflow-y-auto bg-paper px-5 pt-[28vh] pb-10 md:px-10">
            {@render welcome(false)}
          </section>
        {/if}
        {#if panes.article}
          <!-- The reading area: an article, or a person's page, alone in the window (on a phone, in the list's place). -->
          <div class="flex min-w-0 flex-1">
          {#if whoShown && !phone}
            {@render who()}
          {:else if selected}
            <ArticleView
              bind:this={articleView}
              article={selected} {library} {listNote}
              bind:heading={articleHeading}
              bind:preferences
              onStar={() => itemList?.toggleStar()}
              onMarkUnread={() => itemList?.markUnread()}
              onHide={hideFrom}
              onWriter={openWriter}
              onAbout={(id) => go({ kind: "about", id })}
              beforeToolbar={nowPlayingAboveToolbar}
              back={{ name: nameFor(route, placeName), onBack: backToList }}
              phone={phone
                ? {
                    onPrevious: () => move("move", -1),
                    onNext: () => move("move", 1),
                    previous: itemList?.neighbour(-1),
                    next: itemList?.neighbour(1),
                  }
                : undefined}
            />
          {/if}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
  </div>
  {#if !(phone && reading && panes.article && selected)}
    <NowPlaying onOpen={openFromOutside} stepAside={phone} />
  {/if}
</main>

{#snippet nowPlayingAboveToolbar()}
  <NowPlaying onOpen={openFromOutside} bottom={false} stepAside />
{/snippet}

<CheatSheet bind:open={cheatSheetOpen} {unreadOff} />

{#if sheet && tasking}
  <!-- Keyed so one task following the other opens a fresh sheet: the keyboard lands again and no form state lingers. -->
  {#key route.kind}
    <Sheet title={taskTitle} bind:heading={headings.sheet} onClose={closePage} initial={route.kind === "add-feed" && !shared ? () => headings.add : undefined}>
      {@render task(true)}
    </Sheet>
  {/key}
{:else if sheet && editing}
  {@render editor(true)}
{/if}

<!-- Add a feed and "New to feeds?", drawn once for both places: a sheet over the screen, or on a phone a page in the list's place. -->
{#snippet task(inSheet: boolean)}
  {@const onCancel = inSheet ? closePage : undefined}
  {#if route.kind === "add-feed" && shared}
    <FollowPerson address={shared} bind:name={sharedName} onFollowed={added} onOpen={openFeed} {onCancel} page={!inSheet} />
  {:else if route.kind === "add-feed"}
    <AddFeed bind:field={headings.add} bind:asked={foundName} feeds={library.feeds ?? []} folders={library.folders} here={currentFolder?.id} onAdded={added} onOpen={openFeed} {onCancel} page={!inSheet} />
  {:else}
    <StarterFeeds onAdded={startersAdded} {onCancel} page={!inSheet} />
  {/if}
{/snippet}

<!-- A person's or publication's page, or their settings one press from it (decisions 0163, 0267): alone in the window, or on a phone in the list's place. -->
{#snippet who()}
  {#if isWho(route) && currentFeed}
    {#key editKey(currentFeed.id)}
      <WhoPage route={route} feed={currentFeed} {library} {phone} bind:heading={headings.who} {go} {follow} onBack={closeSettingsPage} onClose={closeWho} closeTo={whoFrom && { following: "Everyone you follow", article: "Article" }[whoFrom]} onUnsubscribe={(removeKept) => unsubscribeFrom(currentFeed!, removeKept)} onHide={() => hideFrom(currentFeed!.id)} onMoved={(source, after) => feedMoved(source.id, after.id, () => headings.who)} onSaved={() => itemList?.refresh()} onFolders={showFolders} onOpen={openFromOutside} />
    {/key}
  {/if}
{/snippet}

<!-- The edit screens, drawn once for both places: a sheet over the screen, or on a phone a page in the list's place. -->
{#snippet editor(inSheet: boolean)}
  {@const at = inSheet ? "sheet" : "list"}
  {#if route.kind === "edit-folder" && currentFolder}
    {#key currentFolder.id}
      <EditFolder
        sheet={inSheet}
        folder={currentFolder}
        bind:heading={headings[at]}
        onSaved={() => edited(true)}
        onCancel={() => edited(false)}
        onDelete={() => deleteThis(currentFolder!)}
        onPerson={(name) => personFrom({ ...currentFolder!, name })}
      />
    {/key}
  {/if}
{/snippet}
