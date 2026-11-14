<!--
  The item list (SPEC sections 6, 8 and 9): each article's title, with its
  source and time in quiet small text below. No images, no site icons.
  Unread titles are full strength and semibold, read ones muted and regular,
  starred ones carry a small star: each state shows without color too. With
  Unread off (SPEC section 10) every title looks the same, read or not.

  It shows 50; when you reach the bottom, the next 50 load below by
  themselves, with a small grey "Loading…", and nothing above moves
  (decision 0074). For the keyboard and screen readers, a "Show older articles"
  button sits there too, hidden until it has the keyboard's place. At the
  very end, a quiet caption: "No more results." after a search, and
  "That's everything." anywhere else. Choosing an article (a click, Enter, or j and k)
  selects it and the reading area shows it (SPEC section 7); the next one is
  fetched in advance.

  Refresh and "Mark all as read" (which marks only the articles listed here)
  sit in the list's More menu, in Shell; Mark all as read waits at the end of
  a list with unread articles too (decision 0214). A row's own menu (a
  right-click, a long press, or the Menu key) stars it, marks it read or
  unread, writes back, or goes to the page about its writer (`rowMenu.ts`).
  Search results say how many above
  the list. "New articles · press r" and "Marked 23 articles as read"
  with Undo appear in a note floating at the bottom of the list, so nothing
  shifts. Every mark
  shows at once and is saved behind; if saving fails, the line says so and
  the mark is taken back (SPEC section 25). Articles read in the Unread view
  stay where they are, greyed, until you leave it or press r.

  Unsubscribing and deleting a folder happen elsewhere, then lead here: the
  list arrives with their `notice` already in the line, Undo included.
  Mark all as read's Undo outlives the list (`lastMarkAll.ts`, decision
  0238): the next list arrives with it, naming where it happened, until
  something else is done that can be undone.

  The list never changes on its own (SPEC section 13). Every minute it asks
  the server whether articles have arrived for it; if so, it says "New
  items" and waits. `r` or Refresh loads it again, instantly, since the
  server fetched them already. The one exception (decision 0249): while
  feeds brought from a file wait for their first check, Unread and All
  articles say how many are left (`ListArriving`) and fill in by themselves,
  until an article is opened or older ones are loaded.
-->
<script lang="ts">
  import Dated from "./Dated.svelte";
  import Icon from "./Icon.svelte";
  import { onMount, tick } from "svelte";
  import type { Article, Source } from "./shapes";
  import type { Order } from "./reading";
  import { firstShowing, type Notice } from "./feeds";
  import type { OneSource } from "./people";
  import { CHOOSE_FIRST, NOTHING_TO_UNDO, UNDONE, UNDO_FAILED } from "./messages";
  import type { ListNote } from "./listNote";
  import TextButton from "./TextButton.svelte";
  import LateLine from "./LateLine.svelte";
  import { lastMarkAll, rememberMarkAll, type MarkedAll } from "./lastMarkAll";
  import { endOfList, listArticles, markedAllMessage, newItemsMessage, newItemsWaiting, noFurther, notSavedSignedOut, couldNotLoad, resultCount } from "./lists";
  import { markRead, markStarred, signedOut } from "./saving";
  import { prefetch } from "./articles";
  import { nothingNewSince } from "./times";
  import ItemRow from "./ItemRow.svelte";
  import RowMenu from "./RowMenu.svelte";
  import { rowMenu } from "./rowMenu";
  import type { MenuGroup } from "./MoreMenu.svelte";
  import { listenForStarring } from "./articleDrag";
  import type { EmptyWords } from "./listWording";
  import ListArriving from "./ListArriving.svelte";
  import type { SortedLine } from "./sorting";
  import { askingEvery, bringsIn, showsArrivals } from "./asking";
  import { OTHER_READER_MESSAGE, STRANDED_MESSAGE, updates } from "./updates.svelte";
  import { connection } from "./connection.svelte";
  import { END_OF_KEPT, NOTHING_KEPT_HERE, REFRESH_NEEDS_CONNECTION, SHOWING_KEPT } from "./offline";

  let {
    source,
    order,
    empty,
    bold = [],
    notice,
    selected = $bindable(),
    onChoose,
    onUnreadChange,
    onRefresh,
    results = false,
    oneFeed = false,
    unreadOff = false,
    first = $bindable(),
    rowActions = () => [],
    addressOf = () => "",
    note = $bindable(),
    place,
    checking = 0,
    onChecking = () => {},
    sorted,
  }: {
    source: Source;
    order: Order;
    empty: EmptyWords;
    /** Searched words: words in titles starting with one are shown in bold (SPEC section 14). */
    bold?: string[];
    /** Something done just before arriving, with its Undo. */
    notice?: Notice;
    selected: Article | undefined;
    /** A row was clicked or Enter was pressed on it. `byKeyboard` tells which. */
    onChoose: (byKeyboard: boolean) => void;
    /** A feed's unread count went up or down by `change`, for the sidebar. */
    onUnreadChange: (feedId: number, change: number) => void;
    /** The reader asked for new items; the sidebar's counts load again too. */
    onRefresh: () => void;
    /** These are search results: say how many, and there's nothing new to fetch. */
    results?: boolean;
    /** One person's list: rows don't repeat their name, or say which place each is from (`people.ts` → `sourceOf`). */
    oneFeed?: OneSource;
    /** Unread off (SPEC section 10): every row looks the same, read or not; read state is still recorded. */
    unreadOff?: boolean;
    /** The first article listed, for the empty reading area. */
    first?: Article;
    /** A row's menu, after its star and read: writing back and the page about its writer, then its links (`rowMenu.ts`, `articleLinks.ts`). */
    rowActions?: (article: Article) => MenuGroup[];
    /** An article's own address (decision 0233), for Command-click and a middle click on its row. */
    addressOf?: (article: Article) => string;
    /** The note, for the reading area to show while the list isn't on screen (decision 0229). */
    note?: ListNote;
    /** The list's own name, "Outdoors": a slow first load says "Loading Outdoors…" (decision 0230), and Mark all as read names it. */
    place?: string;
    /** How many feeds brought from a file are still waiting for their first check (decision 0249). */
    checking?: number;
    /** While the list fills in, at each ask: the sidebar's feeds load again. */
    onChecking?: () => void;
    /** Once all of it is checked, how the import was sorted (decision 0264). */
    sorted?: SortedLine;
  } = $props();

  /** What a slow first load says where the rows will be. */
  let loading = $derived(results ? "Searching…" : place ? `Loading ${place}…` : "Loading…");

  /** A list brought from a file is being checked, and this is Unread or All articles (decision 0249, `asking.ts`). */
  let bringingIn = $derived(bringsIn(checking, source));

  let articles: Article[] = $state([]);
  let next: string | null = $state(null);
  let loaded = $state(false);
  let busy = $state(false);
  let problem = $state("");
  /** Listed from the copies kept on this device, without a connection (SPEC section 32). */
  let fromDevice = $state(false);
  let rows: HTMLButtonElement[] = $state([]);
  /** The "Show older articles" button, and the empty line under the list that loads more when it comes into view. */
  let moreButton: HTMLButtonElement | undefined = $state();
  let bottom: HTMLElement | undefined = $state();
  let bottomInView = false;
  let loadingMore = $state(false);
  /** The newest article's number when the list was loaded, and when that was; and whether anything has arrived since. */
  let latest = 0;
  let loadedAt = new Date();
  /** Bumped each time the list loads from the top, so an older "anything new?" answer is ignored. */
  let topLoads = 0;
  let newWaiting = $state(false);
  /** Older articles were loaded below the first page: the list no longer fills in by itself, so they stay (decision 0249). */
  let loadedMore = false;
  // Touch screens have no r key; their note has a Show button instead (same test as the keyboard hint).
  const touch = matchMedia("(hover: none) and (pointer: coarse)").matches;

  /** The floating note's message, and what Undo would do, if anything. */
  let line = $state("");
  let undoLast: (() => void) | undefined = $state();
  /** What the line said for the last undoable action, and how many there have been. */
  let undoMessage = "";
  let actions = 0;
  /** After a mark couldn't be saved: what Try again sends again. */
  let retryLast: (() => void) | undefined = $state();
  let retryWord = $state("Try again");
  /** The note was put away: by its Close button, or by opening an article on a screen with a keyboard (the reader has moved on).
   * `u` still undoes until the list is left; whatever the line says next brings the note back. A failed save is never put away by moving on: it still matters. */
  let closed = $state(false);
  /** What the note's first line shows: nothing once it's put away. */
  let saying = $derived(!closed && !!(line || undoLast));
  /** The article the note was said on: the reading area shows it only there, or while a failure waits (decision 0229). */
  let noteFor: number | undefined = $state();
  $effect(() => void (note = saying && (selected?.id === noteFor || retryLast) ? { words: line, undo: passing ? undefined : undoLast && (() => undo()), retry: retryLast && retryNow, retryWord, close: () => (closed = true) } : undefined));
  /** The last Mark all as read, made here or carried from the list before (decision 0238). */
  let marking: MarkedAll | undefined = lastMarkAll();
  if (marking) {
    const { message, articles: marked } = marking;
    line = undoMessage = message;
    undoLast = () => markUnreadAgain(marked);
    closed = marking.closed;
  }
  // Closing the note (or moving on) carries: the next list keeps it on `u` only.
  $effect(() => {
    const put = closed;
    if (marking && marking === lastMarkAll()) marking.closed = put;
  });

  // The notice is read when the list opens, and again when a move brings a new one to the same list.
  $effect(() => {
    if (!notice || !firstShowing(notice)) return;
    const { message, undo } = notice;
    // Unsubscribing and the rest are newer than any Mark all as read: Undo reverses only the last.
    marking = undefined;
    rememberMarkAll(undefined);
    line = undoMessage = message;
    closed = false;
    if (undo) {
      undoLast = () => {
        undo().then(
          (problem) => {
            if (problem) say(problem);
          },
          () => say(UNDO_FAILED),
        );
      };
    }
  });

  $effect(() => {
    first = articles[0];
  });

  let selectedIndex = $derived(selected ? articles.findIndex((article) => article.id === selected?.id) : -1);

  async function load(after: string | null) {
    if (busy) return;
    busy = true;
    problem = "";
    const firstNew = articles.length;
    const buttonHadFocus = moreButton !== undefined && document.activeElement === moreButton;
    let ok = false;
    loadingMore = after !== null;
    try {
      const page = await listArticles(source, order, after);
      articles = after === null ? page.articles : [...articles, ...page.articles];
      loadedMore = after !== null;
      next = page.next;
      if (after === null) {
        latest = page.latest;
        loadedAt = new Date();
        topLoads++;
      }
      fromDevice = page.kept === true;
      loaded = true;
      ok = true;
    } catch (failure) {
      problem = couldNotLoad(failure);
    }
    busy = false;
    loadingMore = false;
    // At the very end the button goes away. If it had the keyboard's place,
    // rather than lose it, move it to the first article just added.
    if (after !== null && next === null && buttonHadFocus) queueMicrotask(() => rows[firstNew]?.focus());
    // A page short enough that the bottom is still in view loads the next one too.
    if (ok && next !== null) {
      await tick();
      if (bottomInView) load(next);
    }
  }

  // Older items load by themselves once the bottom of the list comes into
  // view (decision 0074). Not after a failure: then the button shows, to try again.
  $effect(() => {
    if (!bottom) return;
    const watching = new IntersectionObserver((entries) => {
      bottomInView = entries.some((entry) => entry.isIntersecting);
      if (bottomInView && next !== null && !problem) load(next);
    });
    watching.observe(bottom);
    return () => watching.disconnect();
  });

  /**
   * `r` and Refresh: loads the list again from the top, with what arrived in
   * the background, and the sidebar's counts with it. Articles still listed
   * keep their place in memory, so the selected one and Undo carry on. An
   * article no longer listed (read, in Unread) isn't selected in the list any
   * more, so `j` starts again from the top, as the list does.
   */
  export async function refresh(asked = false) {
    if (busy) return;
    busy = true;
    const [before, since] = [latest, loadedAt];
    problem = "";
    const focusWasInList = rows.some((row) => row === document.activeElement);
    onRefresh();
    try {
      const page = await listArticles(source, order, null);
      const kept = new Map(articles.map((article) => [article.id, article]));
      articles = page.articles.map((fresh) => {
        const old = kept.get(fresh.id);
        if (!old) return fresh;
        Object.assign(old, fresh);
        return old;
      });
      next = page.next;
      latest = page.latest;
      loadedAt = new Date();
      topLoads++;
      newWaiting = false;
      loadedMore = false;
      fromDevice = page.kept === true;
      loaded = true;
      if (fromDevice) say(REFRESH_NEEDS_CONNECTION);
      // Asked for and nothing came: it says so (decision 0229), unless an Undo is on offer, which r never clears.
      else if (asked && latest === before) inform(nothingNewSince(since));
    } catch (failure) {
      problem = couldNotLoad(failure);
    }
    busy = false;
    // If the keyboard was on a row that's gone (read, in Unread), it moves to
    // the selected row, or the first, rather than being lost.
    if (focusWasInList && !rows.some((row) => row === document.activeElement)) {
      queueMicrotask(() => (rows[selectedIndex] ?? rows[0])?.focus());
    }
  }

  /** Try again after the list couldn't load: it's asked for again from the top, and the keyboard waits on the list's heading as the button goes. */
  function retryList() {
    document.getElementById("list-heading")?.focus({ preventScroll: true });
    void refresh();
  }

  /** Asks the server, quietly, whether new items are waiting for this list. */
  async function askForNew(filling = false) {
    if (!loaded || newWaiting || busy || document.hidden || fromDevice) return;
    const asked = topLoads;
    try {
      const waiting = await newItemsWaiting(source, latest);
      // A refresh while asking already brought whatever was new.
      if (topLoads !== asked || busy) return;
      if (!waiting || !filling) newWaiting = waiting;
      // Filled in by itself (decision 0249), and said to screen readers, as the note would be.
      else void refresh().then(() => ((spoken = ""), tick().then(() => (spoken = "New articles are in the list."))));
    } catch {
      // Nothing to say: it asks again in a minute.
    }
  }

  // Asks every few seconds while filling in, otherwise once a minute (`asking.ts`).
  onMount(() => askingEvery(() => bringingIn && !selected && !loadedMore, (filling) => {
    // The sidebar follows the same asks, so names and "checking…" catch up, and never while the reader reads.
    if (filling) onChecking();
    void askForNew(filling);
  }));
  // A row let go on Starred is starred, as `s` does (decision 0250).
  onMount(() => listenForStarring((id) => {
    const article = articles.find((each) => each.id === id);
    if (article && !article.starred) toggleStar(article);
  }));

  function select(index: number) {
    const article = articles[index];
    if (!article) return;
    // Opening an article is moving on: the note goes (Undo stays on `u`).
    // Not on a touch screen, which has no `u`: there the note's Undo is the only way back.
    if (article.id !== selected?.id && !retryLast && !touch) closed = true;
    selected = article;
    prefetch(article.id);
    const following = articles[index + 1];
    if (following) prefetch(following.id);
  }

  /**
   * Selects the next (1) or previous (-1) article; the first if none is
   * selected yet. Returns false at either end of the list: it never loads
   * more on its own (SPEC.md section 6).
   */
  export function move(step: 1 | -1): boolean {
    const index = selectedIndex === -1 ? 0 : selectedIndex + step;
    if (index < 0 || index >= articles.length) {
      if (selectedIndex !== -1) inform(noFurther(step, next !== null));
      return false;
    }
    select(index);
    return true;
  }

  /**
   * Home (-1) and End (1): the first or last article listed. End goes to
   * the last one loaded; it never loads more (decision 0110). Returns
   * false with nothing listed, or when already there.
   */
  export function moveToEnd(step: 1 | -1): boolean {
    const index = step === 1 ? articles.length - 1 : 0;
    if (articles.length === 0 || index === selectedIndex) return false;
    select(index);
    return true;
  }

  /** Whether `move(step)` has an article to move to; on a phone, the article's Previous and Next say so. */
  export function canMove(step: 1 | -1): boolean {
    const index = selectedIndex === -1 ? 0 : selectedIndex + step;
    return index >= 0 && index < articles.length;
  }

  /** "Skip to articles": the keyboard goes to the selected article, or the first. False with none listed. */
  export function focusList(): boolean {
    const row = rows[selectedIndex] ?? rows[0];
    row?.focus();
    return row !== undefined;
  }

  /** Moves the keyboard's place to the selected article, scrolled into view if needed. */
  export function focusSelected() {
    queueMicrotask(() => rows[selectedIndex]?.focus());
  }

  // What the server last confirmed for each mark, and the newest save sent
  // for it. When a save fails, the mark goes back to what the server has,
  // but only if no later save for the same mark is still on its way: that
  // one decides. So a failure never takes back a later action.
  const confirmed = new Map<string, boolean>();
  const newest = new Map<string, number>();
  let saves = 0;

  /** Remembers a mark as the server has it, the first time it's seen. */
  function known(key: string, value: boolean) {
    if (!confirmed.has(key)) confirmed.set(key, value);
  }

  /**
   * Saves one mark for some articles. `put` sets it on the screen (and keeps
   * the sidebar's counts in step). If saving fails, each article whose mark
   * no later save will settle goes back to what the server has, and the
   * line says `failed`, with Try again. (Saving has already been retried
   * quietly for about a minute by then.) Once a later save goes through, the
   * connection is back and that message has done its job: it goes. A failure
   * that arrives after a newer undoable action leaves that action's Undo in
   * place beside Try again, and the line goes back to it once the failure is
   * dealt with.
   */
  function save(
    field: "read" | "starred",
    changed: Article[],
    value: boolean,
    send: (ids: number[], value: boolean) => Promise<void>,
    put: (article: Article, value: boolean) => void,
    failed: string,
  ) {
    const token = ++saves;
    const action = actions;
    for (const article of changed) {
      const key = `${field}:${article.id}`;
      known(key, article[field]);
      newest.set(key, token);
      put(article, value);
    }
    send(
      changed.map((article) => article.id),
      value,
    ).then(
      () => {
        for (const article of changed) confirmed.set(`${field}:${article.id}`, value);
        if (retryLast) settled();
      },
      (problem) => {
        const takenBack: Article[] = [];
        for (const article of changed) {
          const key = `${field}:${article.id}`;
          if (newest.get(key) !== token) continue;
          const server = confirmed.get(key) ?? !value;
          if (article[field] !== server) {
            put(article, server);
            takenBack.push(article);
          }
        }
        if (takenBack.length === 0) return;
        // Signed out meanwhile: it says so, and Sign in (a reload, which asks and comes back here) is the fix (decision 0230).
        const out = signedOut(problem);
        const retry = out ? () => location.reload() : () => {
          // Only those still as the server has them: anything changed since is left alone.
          const again = takenBack.filter((article) => article[field] !== value);
          if (again.length > 0) save(field, again, value, send, put, failed);
        };
        const words = out ? notSavedSignedOut(field, value, takenBack.length) : failed;
        retryWord = out ? "Sign in" : "Try again";
        if (actions === action) say(words, retry);
        else {
          line = words;
          retryLast = retry;
          // A failure always shows, even if the note was put away.
          closed = false;
        }
      },
    );
  }

  /** Sets read or unread on the screen at once, then saves. */
  function setRead(changing: Article[], read: boolean, failed?: string) {
    const changed = changing.filter((article) => article.read !== read);
    if (changed.length === 0) return;
    failed ??= `${changed.length === 1 ? "The article" : `${changed.length} articles`} couldn't be marked as ${read ? "read" : "unread"}.`;
    save("read", changed, read, markRead, putRead, failed);
  }

  function putRead(article: Article, read: boolean) {
    if (article.read === read) return;
    article.read = read;
    onUnreadChange(article.feedId, read ? -1 : 1);
  }

  function setStarred(article: Article, starred: boolean) {
    save(
      "starred",
      [article],
      starred,
      markStarred,
      (each, value) => (each.starred = value),
      starred ? "The star couldn't be saved." : "The star couldn't be removed.",
    );
  }

  /** The line says something that has nothing to undo; after a failed save, Try again sends it again. */
  export function say(message: string, retry?: () => void) {
    rememberMarkAll((marking = undefined));
    line = message;
    noteFor = selected?.id;
    undoLast = undefined;
    retryLast = retry;
    closed = false;
  }

  /** A passing answer (decision 0229): `u` still undoes the last action; a failed save's line, which matters, stays. */
  let passing = $state(false);
  /** A key that needs an article, with none chosen, says so (decision 0230); an empty list has none to choose. */
  export const needsArticle = () => void (articles.length > 0 && inform(CHOOSE_FIRST));
  export function inform(message: string) {
    if (retryLast) return;
    [line, passing, closed, noteFor] = [message, true, false, selected?.id];
  }

  /**
   * An undoable action happened: the line says what, and Undo reverses it.
   * Called before the action's own marks are saved, so their saves belong
   * to it (see `save`).
   */
  function did(message: string, reverse: () => void, markedAll?: Article[]) {
    marking = markedAll && { message, articles: markedAll, closed: false };
    rememberMarkAll(marking);
    line = undoMessage = message;
    passing = false;
    noteFor = selected?.id;
    undoLast = reverse;
    retryLast = undefined;
    closed = false;
    actions++;
  }

  /** A failed save is dealt with: its message goes, back to the last action's Undo if it's still there. */
  function settled() {
    line = undoLast ? undoMessage : "";
    retryLast = undefined;
  }

  /**
   * Said only to screen readers: opening an article marks it read quietly
   * on screen, but someone who can't see the title turn grey hears it.
   */
  let spoken = $state("");

  /** The reading area showed this article: it counts as read (not an undoable action). */
  export function shown(article: Article) {
    if (article.read) return;
    setRead([article], true, "The article couldn't be marked as read. It's still unread.");
    // Said at once, like everything on screen (SPEC section 25); if saving
    // fails, the line above the list says so and it's unread again.
    // Emptied first, so the same words are announced again for the next article.
    spoken = "";
    tick().then(() => (spoken = "Marked as read."));
  }

  /** `m`, "Mark unread", and a row's menu: the article (the selected one) is unread again, or read. */
  export function markUnread(article = selected, read = false) {
    if (!article || article.read === read) return;
    did(read ? "Marked as read." : "Marked as unread.", () => setRead([article], !read));
    setRead([article], read);
  }

  /** `s`, the star control and a row's menu: stars or unstars the article (the selected one). */
  export function toggleStar(article = selected) {
    if (!article) return;
    const starred = !article.starred;
    did(starred ? "Starred." : "Unstarred.", () => setStarred(article, !starred));
    setStarred(article, starred);
  }

  /** `Shift+A` and "Mark all as read": only the articles listed here, never ones not shown yet. */
  export function markAllRead() {
    const unread = articles.filter((article) => !article.read);
    if (unread.length === 0) {
      say(markedAllMessage(0));
      return;
    }
    did(markedAllMessage(unread.length, results ? undefined : place), () => markUnreadAgain(unread), unread);
    setRead(unread, true);
  }

  /** Undo for Mark all as read, here or in a list after it: each article this list shows is marked unread on its row. */
  function markUnreadAgain(marked: Article[]) {
    const shown = new Map(articles.map((article) => [article.id, article]));
    setRead(
      marked.map((article) => shown.get(article.id) ?? article),
      false,
    );
  }

  /** `u` and Undo: reverses the last undoable action, once. */
  export function undo(): boolean {
    const reverse = undoLast;
    if (!reverse) {
      inform(NOTHING_TO_UNDO);
      return false;
    }
    reverse();
    say(UNDONE);
    return true;
  }

  function retryNow() {
    const retry = retryLast;
    settled();
    retry?.();
  }

  /** The note's Try again, Undo and Close (after which Undo stays on `u`): the button goes, and the keyboard's place stays nearby. */
  const byButton = (press: () => unknown) => () => (press(), keepPlaceNearby());

  /** A note's button is gone once pressed: the keyboard's place stays nearby, on the chosen article or the first. */
  function keepPlaceNearby() {
    if (selectedIndex !== -1) focusSelected();
    else rows[0]?.focus();
  }

  /** A row's menu: which row, and where it was pressed. */
  let menuAt: { index: number; x: number; y: number } | undefined = $state();
  let menuArticle = $derived(menuAt && articles[menuAt.index]);

  /** Opens a row's menu where it was pressed, or (by the keyboard) under the start of its title. */
  function openMenu(index: number, x?: number, y?: number) {
    if (menuAt?.index === index) return;
    const box = rows[index]?.getBoundingClientRect();
    menuAt = { index, x: x ?? (box?.left ?? 0) + 24, y: y ?? (box?.top ?? 0) + 40 };
  }

  function closeMenu(giveBack: boolean) {
    const index = menuAt?.index;
    menuAt = undefined;
    if (giveBack && index !== undefined) rows[index]?.focus();
  }

  load(null);
</script>

{#if results}
  <!-- How many were found, quietly above the results. Present from the start and filled once they load, so screen readers hear it. -->
  <p role="status" class="pt-1 pb-2 text-meta text-muted empty:sr-only">{loaded ? resultCount(articles.length, next !== null) : ""}</p>
{/if}

{#if fromDevice}
  <!-- Without a connection: a quiet line above the list says these are the copies kept here (SPEC section 32). -->
  <p role="status" class="pt-1 pb-2 text-meta text-muted">{SHOWING_KEPT}</p>
{/if}

{#if (bringingIn || (sorted && showsArrivals(source))) && !fromDevice}<ListArriving left={checking} nothingYet={loaded && articles.length === 0} {sorted} />{/if}

{#if loaded && articles.length === 0 && !(bringingIn && !fromDevice)}
  <div class="list-empty"><p class="list-empty-fact">{fromDevice ? NOTHING_KEPT_HERE : empty.fact}</p>{#if !fromDevice && empty.how}<p class="list-empty-how"><Dated text={empty.how} /></p>{/if}{#if !fromDevice && empty.wider}<button type="button" class="btn mt-4" onclick={empty.wider}>Search all articles</button>{/if}</div>
{:else if articles.length > 0}
  <ul class="item-list">
    {#each articles as article, index (article.id)}
      {@const current = index === selectedIndex}
      <li>
        <ItemRow
          bind:row={rows[index]}
          {article} {current} {bold} {unreadOff} {oneFeed} {addressOf}
          tabbable={current || (selectedIndex === -1 && index === 0)}
          held={menuAt?.index === index}
          onOpen={(byKeyboard) => (select(index), onChoose(byKeyboard))}
          onMenu={(x, y) => openMenu(index, x, y)}
          onStep={(step) => move(step) && focusSelected()}
        />
      </li>
    {/each}
  </ul>
  {#if next !== null}
    <!--
      Reaching this line loads the next 50 by themselves; while they load it says so, in small grey
      centred text. The button is there for the keyboard and screen readers: hidden until it has the
      keyboard's place, then a small grey pill. After a failure it shows, to try again.
    -->
    <div bind:this={bottom} class="list-bottom">
      <p role="status" class="text-center text-meta text-muted">{loadingMore ? "Loading…" : ""}</p>
      <button
        type="button"
        bind:this={moreButton}
        aria-disabled={busy}
        onclick={() => load(next)}
        class={["list-more cursor-pointer text-meta", !problem && "list-more-hidden"]}
      >
        {order === "oldest" ? "Show newer articles" : "Show older articles"}
      </button>
    </div>
  {:else if articles.length > 0}
    <!-- A finite list says when it's finished (SPEC.md section 6): a quiet caption on the row titles' edge, with room under it so the list visibly stops (decision 0142). -->
    <p class="list-end">{fromDevice ? END_OF_KEPT : endOfList(source)}</p>
    <!-- At the end of a list with unread articles: marking them all, where the reader has just finished (decision 0214). -->
    {#if !unreadOff && !results && articles.some((article) => !article.read)}<button type="button" class="btn list-end-action" onclick={() => (markAllRead(), keepPlaceNearby())}>Mark all as read</button>{/if}
  {/if}
{:else if !loaded && !problem}
  <LateLine class="list-end" words={loading} />
{/if}
{#if menuAt && menuArticle}
  {@const article = menuArticle}
  <RowMenu label={`Actions for ${article.title || "Untitled"}`} at={menuAt} onClose={closeMenu} groups={rowMenu(article, unreadOff, { star: toggleStar, read: markUnread }, rowActions(article))} />
{/if}
{#if problem}
  <!-- Try again only where it's the fix: never without a connection, which says when it works again. -->
  <p role="status" class="mt-4">{problem}{#if !connection.offline}{" "}<TextButton onclick={retryList}>Try again</TextButton>{/if}</p>
{/if}
<!--
  What was just done (with Undo), "New articles · press r", or that nine turtles was
  updated: a small note at the foot of the list pane, so nothing in the list
  moves when it appears. It sits in a band of the page's color, as the list is, that the
  rows end above, so it never lies over the rows you're acting on
  (decision 0048). Empty, it's hidden but stays for screen readers, which
  hear each message as it arrives.
-->
<div class={["toast-band sticky bottom-0 z-10 mt-auto flex justify-center", !!(saying || updates.stranded || updates.otherReader || newWaiting) && "toast-band-shown"]}>
  <div
    class={[
      "toast pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 text-meta text-ink-2",
      saying || updates.stranded || updates.otherReader || newWaiting ? "min-h-11 border px-4" : "sr-only",
    ]}
  >
    <!-- The words on the left (wrapping if they must, with room above and below), the buttons on the right, centred beside them. -->
    <p class={["flex items-center gap-x-2", !saying && "sr-only"]}>
      <span role="status" class="min-w-0 py-2"><Dated text={line} /></span>
      <span aria-live="polite" class="sr-only">{spoken}</span>
      {#if retryLast}
        <TextButton onclick={byButton(retryNow)} class="-mr-2 px-2">{retryWord}</TextButton>
      {/if}
      {#if undoLast && saying && !passing}
        <TextButton onclick={byButton(undo)} class="-mr-2 px-2">Undo</TextButton>
      {/if}
      {#if saying}
        <button type="button" onclick={byButton(() => (closed = true))} aria-label="Close the note" title="Close the note" class="btn-quiet btn-icon -mr-3 shrink-0"><Icon name="close" size="alone" /></button>
      {/if}
    </p>
    <p class={["flex items-center", !(updates.stranded || updates.otherReader || newWaiting) && "sr-only"]}>
      <span role="status">{updates.otherReader ? OTHER_READER_MESSAGE : updates.stranded ? STRANDED_MESSAGE : newWaiting ? newItemsMessage(touch) : ""}</span>
      {#if updates.stranded || updates.otherReader}
        <TextButton onclick={() => location.reload()} class="ml-2">Reload</TextButton>
      {:else if newWaiting && touch}
        <!-- No r key on a touch screen, and Refresh sits in the More menu: the note offers to show them. -->
        <TextButton onclick={() => refresh()} aria-label="Show new articles" class="ml-2">Show</TextButton>
      {/if}
    </p>
  </div>
</div>
