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

  The list never changes on its own (SPEC section 13). Every minute it asks
  the server whether articles have arrived for it; if so, it says "New
  items" and waits. `r` or Refresh loads it again, instantly, since the
  server fetched them already.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";
  import { onMount, tick } from "svelte";
  import { untitledOpening, type Article, type Source } from "./shapes";
  import type { Order } from "./reading";
  import { firstShowing, type Notice } from "./feeds";
  import { sourceOf, writerOf, type OneSource } from "./people";
  import { CHOOSE_FIRST, NOTHING_TO_UNDO, UNDONE, UNDO_FAILED } from "./messages";
  import type { ListNote } from "./listNote";
  import TextButton from "./TextButton.svelte";
  import LateLine from "./LateLine.svelte";
  import { endOfList, listArticles, markedAllMessage, newItemsMessage, newItemsWaiting, noFurther, notSavedSignedOut, couldNotLoad, resultCount } from "./lists";
  import { markRead, markStarred, signedOut } from "./saving";
  import { prefetch } from "./articles";
  import { exactly, nothingNewSince, when } from "./times";
  import { hugEllipsis } from "./hug";
  import RowKind from "./RowKind.svelte";
  import RowPlace from "./RowPlace.svelte";
  import RowMenu from "./RowMenu.svelte";
  import { rowMenu } from "./rowMenu";
  import { longPress } from "./longPress";
  import type { MenuItem } from "./MoreMenu.svelte";
  import type { EmptyWords } from "./listWording";
  import { boldParts } from "./search";
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
    found = $bindable(""),
    rowActions = () => [],
    note = $bindable(),
    loading = "Loading…",
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
    /** What the line above search results says ("28 results"): empty until they load, and when this isn't a search. */
    found?: string;
    /** A row's menu, after its star and read: writing back and the page about its writer (`rowMenu.ts` → `writerItems`). */
    rowActions?: (article: Article) => MenuItem[];
    /** The note, for the reading area to show while the list isn't on screen (decision 0229). */
    note?: ListNote;
    /** What a slow first load says where the rows will be, "Loading Outdoors…" (decision 0230). */
    loading?: string;
  } = $props();

  /** How often the list asks whether new items are waiting. */
  const ASK_EVERY_MS = 60_000;

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
  /**
   * The note was put away: by its Close button, or by opening an article on a
   * screen with a keyboard (the reader has moved on). `u` still undoes until the list is left; whatever
   * the line says next brings the note back. A failed save is never put away
   * by moving on: it still matters.
   */
  let closed = $state(false);
  /** What the note's first line shows: nothing once it's put away. */
  let saying = $derived(!closed && !!(line || undoLast));
  /** The article the note was said on: the reading area shows it only there, or while a failure waits (decision 0229). */
  let noteFor: number | undefined = $state();
  $effect(() => void (note = saying && (selected?.id === noteFor || retryLast) ? { words: line, undo: passing ? undefined : undoLast && (() => undo()), retry: retryLast && retryNow, retryWord, close: () => (closed = true) } : undefined));
  // The notice is read when the list opens, and again when a move brings a new one to the same list.
  $effect(() => {
    if (!notice || !firstShowing(notice)) return;
    const { message, undo } = notice;
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

  $effect(() => {
    found = results && loaded ? resultCount(articles.length, next !== null) : "";
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
  async function askForNew() {
    if (!loaded || newWaiting || busy || document.hidden || fromDevice) return;
    const asked = topLoads;
    try {
      const waiting = await newItemsWaiting(source, latest);
      // A refresh while asking already brought whatever was new.
      if (topLoads === asked && !busy) newWaiting = waiting;
    } catch {
      // Nothing to say: it asks again in a minute.
    }
  }

  onMount(() => {
    const asking = setInterval(askForNew, ASK_EVERY_MS);
    return () => clearInterval(asking);
  });

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
  function inform(message: string) {
    if (retryLast) return;
    [line, passing, closed, noteFor] = [message, true, false, selected?.id];
  }

  /**
   * An undoable action happened: the line says what, and Undo reverses it.
   * Called before the action's own marks are saved, so their saves belong
   * to it (see `save`).
   */
  function did(message: string, reverse: () => void) {
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
    did(markedAllMessage(unread.length), () => setRead(unread, false));
    setRead(unread, true);
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

  function arrows(event: KeyboardEvent, index: number) {
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      openMenu(index);
      return;
    }
    // The arrow keys work like j and k while the keyboard is in the list.
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (move(event.key === "ArrowDown" ? 1 : -1)) focusSelected();
  }

  load(null);
</script>

{#if results}
  <!-- How many were found, quietly above the results. Present from the start and filled once they load, so screen readers hear it. -->
  <p role="status" data-result-count class="pt-1 pb-2 text-meta text-muted empty:sr-only">{loaded ? resultCount(articles.length, next !== null) : ""}</p>
{/if}

{#if fromDevice}
  <!-- Without a connection: a quiet line above the list says these are the copies kept here (SPEC section 32). -->
  <p role="status" class="pt-1 pb-2 text-meta text-muted">{SHOWING_KEPT}</p>
{/if}

{#if loaded && articles.length === 0}
  <div class="list-empty"><p class="list-empty-fact">{fromDevice ? NOTHING_KEPT_HERE : empty.fact}</p>{#if !fromDevice && empty.how}<p class="list-empty-how">{empty.how}</p>{/if}{#if !fromDevice && empty.wider}<button type="button" class="btn mt-4" onclick={empty.wider}>Search all articles</button>{/if}</div>
{:else if articles.length > 0}
  <ul class="item-list">
    {#each articles as article, index (article.id)}
      {@const current = index === selectedIndex}
      {@const opening = untitledOpening(article)}
      <li>
        <!-- Only one row is a Tab stop (the selected one, or the first); the others are reached with j, k or the arrows. -->
        <button
          type="button"
          bind:this={rows[index]}
          tabindex={current || (selectedIndex === -1 && index === 0) ? 0 : -1}
          aria-current={current ? "true" : undefined}
          data-held={menuAt?.index === index ? "" : undefined /* held in the pointer's tone while its own menu is open, so it's clear which article the menu acts on (decision 0214) */}
          data-space-reads
          onclick={(event) => {
            select(index);
            // A click made with Enter has no mouse position.
            onChoose(event.detail === 0);
          }}
          onkeydown={(event) => arrows(event, index)}
          oncontextmenu={(event) => {
            event.preventDefault();
            // A press has a place; the keyboard's (where the browser sends it) is the row's.
            openMenu(index, event.clientX || undefined, event.clientY || undefined);
          }}
          use:longPress={(x, y) => openMenu(index, x, y)}
          class={[
            "item-row place block cursor-pointer pr-4 text-left",
          ]}
        >
          <!-- Unread: an accent dot in the gutter beside the title, and a semibold title, so it shows without color. -->
          {#if !article.read && !unreadOff}<span aria-hidden="true" class="unread-dot"></span>{/if}
          <!-- Unread: full ink, semibold. Read: the second ink, regular. The selected row is never the quietest. With Unread off every title is full ink, regular. -->
          <!-- In the reading serif; with a mouse, clearly larger (19px) than the interface text, so the title leads its row (app.css .item-row). -->
          <!-- An untitled post shows its opening once instead (SPEC section 6, decision 0196): the same serif, never semibold so it doesn't pose as a title, two lines and then "…". -->
          <span class={["title font-serif text-(length:--row-title-size) leading-(--row-title-line)", opening === undefined ? "block" : "line-clamp-2", unreadOff ? "text-ink" : !article.read ? [opening === undefined && "font-semibold", "text-ink"] : current ? "text-ink" : "text-ink-2"]}
            ><bdi
              >{#each boldParts(opening ?? article.title, bold) as part, partIndex (partIndex)}{#if part.bold}<mark class="match"
                    >{part.text}</mark
                  >{:else}{part.text}{/if}{/each}</bdi
            >{#if !article.read && !unreadOff}<span class="sr-only">, unread</span>{/if}</span
          >
          {#if article.excerpt && article.excerpt.length > 0}
            <!--
              A search result's text around the first searched word (SPEC section 14), right under
              the title and before the meta line, as Apple Books orders a result: plain text from
              nine turtles, shown as text, up to two lines. Searched words are marked as in the title
              (a faint accent tone behind them, and an underline) and in full ink, so they show by
              tone and shape.
            -->
            <span class="excerpt mt-0.5 line-clamp-2 text-meta text-muted"
              >{#each article.excerpt as piece, pieceIndex (pieceIndex)}{#if piece.match}<mark class="match"
                    >{piece.text}</mark
                  >{:else}{piece.text}{/if}{/each}</span
            >
          {/if}
          <!--
            Always one line (decision 0048): a long source name ends in "…", the time and star never wrap. The "·" hugs the "…" (decision 0051). The whole line
            is 12px, so the title leads: the time a step fainter than muted grey, the publisher's name in muted grey
            (.row-feed, decision 0123) so the credit reads first; on the selected row both are muted grey (AA).
          -->
          <span class={["row-meta mt-2 text-[0.75rem] tracking-[0.06em]", current ? "text-muted" : "text-[color:var(--faint)]"]}>
            <!-- A publication's writer first, when its feed names one (the owner's core path, point 4). -->
            {#if writerOf(article)}<span class="row-feed"><span class="row-feed-name" use:hugEllipsis={writerOf(article)}>{writerOf(article)}</span>&nbsp;·</span>{/if}
            <span class={oneFeed === true ? "sr-only" : "row-feed"}><span class="row-feed-name" use:hugEllipsis={sourceOf(article, oneFeed)}>{sourceOf(article, oneFeed)}</span>&nbsp;·</span>
            <time datetime={new Date(article.at * 1000).toISOString()} class="row-date" title={exactly(article.at)}>{when(article.at)}</time>
            <!-- A podcast's episode or a YouTube video says so, in the line's own ink (RowKind.svelte). -->
            <RowKind {article} />
            <!-- Your place, while one is kept: "· Half read" (decision 0224). -->
            <RowPlace article={article.id} />
            {#if article.muted}
              <!-- Only search (and Starred) list a muted article; the word says why it waits in no other list (SPEC section 27). -->
              <span class="row-muted">· Hidden</span>
            {/if}
            {#if article.starred}
              <span class="row-star"><Icon name="star" size={13} filled /><span class="sr-only">, Starred</span></span>
            {/if}
          </span>
        </button>
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
      "toast pointer-events-auto flex min-h-11 max-w-full flex-wrap items-center gap-x-3 rounded-lg border px-4 text-small text-ink-2",
      !(saying || updates.stranded || updates.otherReader || newWaiting) && "sr-only",
    ]}
  >
    <!-- The words on the left (wrapping if they must, with room above and below), the buttons on the right, centred beside them. -->
    <p class={["flex items-center gap-x-2", !saying && "sr-only"]}>
      <span role="status" class="min-w-0 py-2">{line}</span>
      <span aria-live="polite" class="sr-only">{spoken}</span>
      {#if retryLast}
        <TextButton onclick={byButton(retryNow)} class="-mr-2 px-2">{retryWord}</TextButton>
      {/if}
      {#if undoLast && saying && !passing}
        <TextButton onclick={byButton(undo)} class="-mr-2 px-2">Undo</TextButton>
      {/if}
      {#if saying}
        <button type="button" onclick={byButton(() => (closed = true))} aria-label="Close the note" title="Close the note" class="btn-quiet btn-icon -mr-2.5 shrink-0"><Icon name="close" size={18} /></button>
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

<style>
  /*
    A searched word, in a title or in the line of text under it: one style,
    a faint tone of the accent behind it with small rounded corners, in the
    text's own weight and color, and a fine underline so it never shows by
    tone alone (SPEC.md section 6, decision 0037).
  */
  .match {
    padding: 0 1px;
    text-decoration: underline 1px color-mix(in srgb, currentColor 45%, transparent);
    text-underline-offset: 0.2em;
    border-radius: 3px;
    background-color: var(--mark);
    color: inherit;
    font-weight: inherit;
  }
  /* In the muted line of text, the searched words are in full ink too. */
  .excerpt .match {
    color: var(--ink);
  }
</style>
