<!--
  The item list (SPEC sections 6, 8 and 9): each article's title, with its
  source and time in quiet small text below. No images, no site icons.
  Unread titles are full strength and semibold, read ones muted and regular,
  starred ones carry a small star: each state shows without color too. In
  river mode (SPEC section 10) every title looks the same, read or not, and
  so does every title from a feed set to flow past in Edit feed.

  It shows 50; when you reach the bottom, the next 50 load below by
  themselves, with a small grey "Loading…", and nothing above moves
  (decision 0074). For the keyboard and screen readers, a "Show older articles"
  button sits there too, hidden until it has the keyboard's place. At the
  very end, a quiet caption: "You're all caught up." in Unread, "No more
  results." after a search, and "That's everything." anywhere else. Choosing an article (a click, Enter, or j and k)
  selects it and the reading area shows it (SPEC section 7); the next one is
  fetched in advance.

  Refresh and "Mark all as read" (which marks only the articles listed here)
  sit beside the list's title, in Shell; search results say how many above
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
  import { onMount, tick, untrack } from "svelte";
  import {
    catchUp as catchUpOnServer,
    caughtUpMessage,
    dayHeading,
    endOfList,
    listArticles,
    markedAllMessage,
    markRead,
    markStarred,
    newItemsMessage,
    newItemsWaiting,
    nothingPastMessage,
    noteOpened,
    prefetch,
    readPast,
    when,
    type Article,
    type Notice,
    type Order,
    type Source,
    uncatchUp,
  } from "./feeds";
  import { hugEllipsis } from "./hug";
  import { length } from "./podcasts";
  import { boldParts } from "./search";
  import { STRANDED_MESSAGE, updates } from "./updates.svelte";
  import { connection } from "./connection.svelte";
  import { END_OF_KEPT, NOTHING_KEPT_HERE, NeedsConnection, REFRESH_NEEDS_CONNECTION, SHOWING_KEPT } from "./offline";

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
    onCounts = () => {},
    results = false,
    oneFeed = false,
    river = false,
    flowing = new Set(),
    count = $bindable(0),
    found = $bindable(""),
  }: {
    source: Source;
    order: Order;
    empty: string;
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
    /** Articles not listed here changed too ("Catch me up" and its Undo): the sidebar's counts load again. */
    onCounts?: () => void;
    /** These are search results: say how many, and there's nothing new to fetch. */
    results?: boolean;
    /** Every article here is from one feed (its own list), so the rows don't repeat its name. */
    oneFeed?: boolean;
    /** River mode (SPEC section 10): every row looks the same, read or not; read state is still recorded. */
    river?: boolean;
    /** Feeds set to flow past in Edit feed (SPEC section 15): their rows look as in river mode. */
    flowing?: Set<number>;
    /** How many articles are listed, for the empty reading area's hint. */
    count?: number;
    /** What the line above search results says ("28 results"): empty until they load, and when this isn't a search. */
    found?: string;
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
  /** The newest article's number when the list was loaded, and whether anything has arrived since. */
  let latest = 0;
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
  // The notice is read once, when the list opens.
  untrack(() => {
    if (!notice) return;
    const { message, undo } = notice;
    line = undoMessage = message;
    if (undo) {
      undoLast = () => {
        undo().then((problem) => {
          if (problem) say(problem);
        });
      };
    }
  });

  $effect(() => {
    count = articles.length;
  });

  $effect(() => {
    found = results && loaded ? resultCount(articles.length, next !== null) : "";
  });

  let selectedIndex = $derived(selected ? articles.findIndex((article) => article.id === selected?.id) : -1);

  /**
   * Recently read only: a quiet heading where the day each was opened
   * changes ("Today", "Yesterday", "Monday", "12 October"; SPEC section 5),
   * worked out against the moment the list loaded, so they never change
   * while it's on screen.
   */
  let loadedAt = $state(new Date());
  let days = $derived(
    "view" in source && source.view === "recent"
      ? articles.map((article) => (article.opened === undefined ? "" : dayHeading(article.opened, loadedAt)))
      : [],
  );

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
      if (after === null) loadedAt = new Date();
      next = page.next;
      if (after === null) {
        latest = page.latest;
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
  export async function refresh() {
    if (busy) return;
    busy = true;
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
      loadedAt = new Date();
      next = page.next;
      latest = page.latest;
      topLoads++;
      newWaiting = false;
      fromDevice = page.kept === true;
      loaded = true;
      if (fromDevice) say(REFRESH_NEEDS_CONNECTION);
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

  /** What the list says when it couldn't load: without a connection, search says plainly that it needs one. */
  function couldNotLoad(failure: unknown): string {
    if (failure instanceof NeedsConnection) return failure.message;
    if (connection.offline) return "These articles need a connection. They load once you're back online.";
    return "The articles couldn't be loaded. Try again in a moment.";
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
    if (index < 0 || index >= articles.length) return false;
    select(index);
    return true;
  }

  /**
   * `n` and `Shift+N`: the next (1) or previous (-1) unread article listed,
   * passing over read ones; from the top (or the foot) if none is selected
   * yet. Returns false when there's none that way: like `j`, it never loads
   * more on its own.
   */
  export function moveUnread(step: 1 | -1): boolean {
    let index = selectedIndex === -1 ? (step === 1 ? 0 : articles.length - 1) : selectedIndex + step;
    while (index >= 0 && index < articles.length && articles[index]!.read) index += step;
    if (index < 0 || index >= articles.length) return false;
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
      () => {
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
        const retry = () => {
          // Only those still as the server has them: anything changed since is left alone.
          const again = takenBack.filter((article) => article[field] !== value);
          if (again.length > 0) save(field, again, value, send, put, failed);
        };
        if (actions === action) say(failed, retry);
        else {
          line = failed;
          retryLast = retry;
        }
      },
    );
  }

  /** Sets read or unread on the screen at once, then saves. */
  function setRead(changing: Article[], read: boolean, failed = "That couldn't be saved, so it was taken back.") {
    const changed = changing.filter((article) => article.read !== read);
    if (changed.length === 0) return;
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
    undoLast = undefined;
    retryLast = retry;
  }

  /**
   * An undoable action happened: the line says what, and Undo reverses it.
   * Called before the action's own marks are saved, so their saves belong
   * to it (see `save`).
   */
  function did(message: string, reverse: () => void) {
    line = undoMessage = message;
    undoLast = reverse;
    retryLast = undefined;
    actions++;
  }

  /**
   * Something undoable done elsewhere (a Save in "Add to collection" that
   * took the article off a collection): the line says what, and Undo calls
   * `reverse`, saying its problem if it couldn't.
   */
  export function offer(message: string, reverse: () => Promise<string | undefined>) {
    did(message, () => {
      reverse().then((problem) => {
        if (problem) say(problem);
      });
    });
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

  /** The reading area showed this article: it counts as read (not an undoable action), and joins Recently read. */
  export function shown(article: Article) {
    noteOpened(article.id);
    if (article.read) return;
    setRead([article], true, "An article couldn't be marked as read. It's still unread.");
    // Said at once, like everything on screen (SPEC section 25); if saving
    // fails, the line above the list says so and it's unread again.
    // Emptied first, so the same words are announced again for the next article.
    spoken = "";
    tick().then(() => (spoken = "Marked as read"));
  }

  /** `m` and "Mark unread": the selected article is unread again. */
  export function markUnread() {
    const article = selected;
    if (!article || !article.read) return;
    did("Marked as unread", () => setRead([article], true));
    setRead([article], false);
  }

  /** `s` and the star control: stars or unstars the selected article. */
  export function toggleStar() {
    const article = selected;
    if (!article) return;
    const starred = !article.starred;
    did(starred ? "Starred" : "Unstarred", () => setStarred(article, !starred));
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

  /**
   * "Catch me up" (decision 0097): everything in Unread from before today
   * counts as read, listed here or not. Those listed turn grey where they
   * are; Undo makes exactly the same articles unread again.
   */
  export async function catchUp() {
    let ids: number[];
    try {
      ids = await catchUpOnServer();
    } catch (failure) {
      // The answer may have been lost after the server caught up: Refresh shows where things stand.
      say(failure instanceof NeedsConnection ? failure.message : "Catching up couldn't be confirmed. Refresh to see where things stand.");
      return;
    }
    if (ids.length === 0) {
      say(caughtUpMessage(0));
      return;
    }
    const marked = new Set(ids);
    const listed = articles.filter((article) => !article.read && marked.has(article.id));
    for (const article of listed) {
      confirmed.set(`read:${article.id}`, true);
      putRead(article, true);
    }
    onCounts();
    did(caughtUpMessage(ids.length), () =>
      save(
        "read",
        listed,
        false,
        async () => {
          await uncatchUp(ids);
          onCounts();
        },
        putRead,
        "Undo couldn't be saved, so they're still read.",
      ),
    );
  }

  /** A "mark past this one" is being worked out: a second press waits for it rather than racing it. */
  let markingPast = false;

  /**
   * `Shift+O` ("older"), and "Mark all above as read" and "Mark all below as
   * read" from the list's More menu (decision 0103): every unread article on
   * one side of the selected one counts as read, including those the list
   * hasn't loaded yet, but never one that arrived after it was loaded. Above
   * and below go by the rows' order; older by their dates, which in a feed,
   * folder or view is the same thing. Nothing moves; Undo makes exactly
   * those articles unread again.
   */
  export async function markPast(kind: "older" | "above" | "below") {
    const chosen = selected;
    const index = selectedIndex;
    if (!chosen || index === -1 || markingPast) return;
    // In a list by date, older is below when newest first, and above when oldest first.
    const side: "older" | "newer" = kind === "older" ? "older" : (kind === "below") === (order === "newest") ? "older" : "newer";
    const towardsEnd = results ? kind !== "above" : (side === "older") === (order === "newest");
    const before = (article: Article) => article.at < chosen.at || (article.at === chosen.at && article.id < chosen.id);
    // What's listed on that side: by position, or, in search results (ordered by how well they match), older by date.
    const listed =
      results && kind === "older"
        ? articles.filter((article) => article.id !== chosen.id && before(article))
        : towardsEnd
          ? articles.slice(index + 1)
          : articles.slice(0, index);
    const unlisted = towardsEnd && next !== null && !fromDevice;
    if (unlisted && !("search" in source)) {
      markingPast = true;
      try {
        await markPastOnServer(source, side, chosen, kind);
      } finally {
        markingPast = false;
      }
      return;
    }
    let more: Article[] = [];
    if (unlisted) {
      // Search results come page by page: the rest are asked for, and marked by name like the rows shown.
      markingPast = true;
      try {
        more = await rest();
      } catch (failure) {
        say(failure instanceof NeedsConnection ? failure.message : "The rest of the list couldn't be loaded, so nothing was marked. Try again in a moment.");
        return;
      } finally {
        markingPast = false;
      }
      // Never one that arrived after the search ran, as the server does for lists.
      more = more.filter((article) => article.id <= latest && (kind !== "older" || before(article)));
      // Rows loaded while waiting are the same articles: marked as the rows they are, so they turn grey too.
      const shown = new Map(articles.map((article) => [article.id, article]));
      const counted = new Set(listed);
      more = more.map((article) => shown.get(article.id) ?? article).filter((article) => !counted.has(article));
    }
    const unread = [...listed, ...more].filter((article) => !article.read);
    if (unread.length === 0) {
      say(nothingPastMessage(kind));
      return;
    }
    did(markedAllMessage(unread.length), () => setRead(unread, false));
    setRead(unread, true);
  }

  /** The rest of a list after what's loaded, page by page, kept apart from the rows shown (they don't grow by themselves). */
  async function rest(): Promise<Article[]> {
    const found: Article[] = [];
    let after = next;
    // At most what one mark can name (the server's limit of 10,000).
    for (let pages = 0; after !== null && pages < 190; pages++) {
      const page = await listArticles(source, order, after);
      found.push(...page.articles);
      after = page.next;
    }
    return found;
  }

  /** The server marks the side of the list not loaded yet too, and answers which, as Catch me up does. */
  async function markPastOnServer(
    list: Exclude<Source, { search: Record<string, string> }>,
    side: "older" | "newer",
    chosen: Article,
    kind: "older" | "above" | "below",
  ) {
    let ids: number[];
    try {
      ids = await readPast(list, side, chosen, latest);
    } catch (failure) {
      say(failure instanceof NeedsConnection ? failure.message : "Marking those as read couldn't be confirmed. Refresh to see where things stand.");
      return;
    }
    if (ids.length === 0) {
      say(nothingPastMessage(kind));
      return;
    }
    // Worked out from the rows as they are now, so any loaded while waiting are shown read too.
    const marked = new Set(ids);
    const shown = articles.filter((article) => !article.read && marked.has(article.id));
    for (const article of shown) {
      confirmed.set(`read:${article.id}`, true);
      putRead(article, true);
    }
    onCounts();
    did(markedAllMessage(ids.length), () =>
      save(
        "read",
        shown,
        false,
        async () => {
          await uncatchUp(ids);
          onCounts();
        },
        putRead,
        "Undo couldn't be saved, so they're still read.",
      ),
    );
  }

  /** `u` and Undo: reverses the last undoable action, once. */
  export function undo(): boolean {
    const reverse = undoLast;
    if (!reverse) return false;
    reverse();
    say("Undone.");
    return true;
  }

  function retryByButton() {
    const retry = retryLast;
    settled();
    retry?.();
    // The button is gone; keep the keyboard's place nearby, as Undo does.
    if (selectedIndex !== -1) focusSelected();
    else rows[0]?.focus();
  }

  function undoByButton() {
    undo();
    // The button is gone; keep the keyboard's place nearby: the chosen article, or the first.
    if (selectedIndex !== -1) focusSelected();
    else rows[0]?.focus();
  }

  function arrows(event: KeyboardEvent) {
    // The arrow keys work like j and k while the keyboard is in the list.
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (move(event.key === "ArrowDown" ? 1 : -1)) focusSelected();
  }

  /** "1 result", "12 results", or "50+ results" while older ones are still to load. */
  function resultCount(count: number, more: boolean): string {
    if (count === 0) return "";
    return `${count}${more ? "+" : ""} ${count === 1 && !more ? "result" : "results"}`;
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

{#if loaded && articles.length === 0}
  <p>{fromDevice ? NOTHING_KEPT_HERE : empty}</p>
{:else if articles.length > 0}
  <ul class="item-list">
    {#each articles as article, index (article.id)}
      {@const current = index === selectedIndex}
      {@const flows = river || flowing.has(article.feedId)}
      <li>
        {#if days[index] && days[index] !== days[index - 1]}
          <!-- Recently read's day heading: small, semibold and muted, as the sidebar's section names are. -->
          <h3 class="list-day">{days[index]}</h3>
        {/if}
        <!-- Only one row is a Tab stop (the selected one, or the first); the others are reached with j, k or the arrows. -->
        <button
          type="button"
          bind:this={rows[index]}
          tabindex={current || (selectedIndex === -1 && index === 0) ? 0 : -1}
          aria-current={current ? "true" : undefined}
          data-space-reads
          onclick={(event) => {
            select(index);
            // A click made with Enter has no mouse position.
            onChoose(event.detail === 0);
          }}
          onkeydown={arrows}
          class={[
            "item-row place block cursor-pointer pr-4 text-left",
          ]}
        >
          <!-- Unread: an accent dot in the gutter beside the title, and a semibold title, so it shows without color. -->
          {#if !article.read && !flows}<span aria-hidden="true" class="unread-dot"></span>{/if}
          <!-- Unread: full ink, semibold. Read: the second ink, regular. The selected row is never the quietest. In river mode every title is full ink, regular. -->
          <!-- With a mouse, clearly larger (18px) than the interface text, so the title leads its row. -->
          <span class={["title block text-ui pointer-fine:text-[1.125rem] pointer-fine:leading-[1.3]", flows ? "text-ink" : !article.read ? "font-semibold text-ink" : current ? "text-ink" : "text-ink-2"]}
            >{#each boldParts(article.title || "Untitled", bold) as part, partIndex (partIndex)}{#if part.bold}<mark class="match"
                  >{part.text}</mark
                >{:else}{part.text}{/if}{/each}{#if !article.read && !flows}<span class="sr-only">, unread</span>{/if}</span
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
            Always one line, as Apple Books' rows are (decision 0048): a long source name ends in "…",
            and the time and the star never wrap below it. The "·" hugs the "…" (decision 0051). The whole line
            is 12px and a step fainter than muted grey, so the title leads; on the selected row it's muted grey (AA).
          -->
          <span class={["row-meta mt-1 text-[0.75rem]", current ? "text-muted" : "text-[color:var(--faint)]"]}>
            <span class={oneFeed ? "sr-only" : "row-feed"}><span class="row-feed-name" use:hugEllipsis={article.feedTitle}>{article.feedTitle}</span>&nbsp;·</span>
            <time datetime={new Date(article.at * 1000).toISOString()} class="row-date">{when(article.at)}</time>
            {#if article.episode}
              <!-- A podcast's episode (SPEC section 35): a small headphones mark in the line's own ink, and its length. -->
              <span class="row-episode">·&nbsp;<Icon name="headphones" size={13} /><span class="sr-only">Episode</span>{#if article.episodeSeconds}&nbsp;{length(article.episodeSeconds)}{/if}</span>
            {/if}
            {#if article.muted}
              <!-- Only search (and Starred) list a muted article; the word says why it waits in no other list (SPEC section 27). -->
              <span class="row-muted">· Muted</span>
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
    <!-- A finite list says when it's finished (SPEC.md section 6): a quiet caption centred under the last row. -->
    <p class="mt-5 text-center text-meta text-muted">{fromDevice ? END_OF_KEPT : endOfList(source)}</p>
  {/if}
{/if}
{#if problem}
  <p role="status" class="mt-4">{problem}</p>
{/if}
<!--
  What was just done (with Undo), "New articles · press r", or that nine turtles was
  updated: a small note at the foot of the list pane, so nothing in the list
  moves when it appears. It sits in a band of the list's own tone that the
  rows end above, so it never lies over the rows you're acting on
  (decision 0048). Empty, it's hidden but stays for screen readers, which
  hear each message as it arrives.
-->
<div class={["toast-band sticky bottom-0 z-10 mt-auto flex justify-center", !!(line || undoLast || updates.stranded || newWaiting) && "toast-band-shown"]}>
  <div
    class={[
      "toast pointer-events-auto flex min-h-11 max-w-full flex-wrap items-center gap-x-3 rounded-lg border px-4 text-small text-ink-2",
      !(line || undoLast || updates.stranded || newWaiting) && "sr-only",
    ]}
  >
    <p class={["flex flex-wrap items-center gap-x-2", !(line || undoLast) && "sr-only"]}>
      <span role="status">{line}</span>
      <span aria-live="polite" class="sr-only">{spoken}</span>
      {#if retryLast}
        <button type="button" onclick={retryByButton} class="-mr-2 min-h-11 min-w-11 px-2 font-semibold text-ink underline underline-offset-4">Try again</button>
      {/if}
      {#if undoLast}
        <button type="button" onclick={undoByButton} class="-mr-2 min-h-11 min-w-11 px-2 font-semibold text-ink underline underline-offset-4">Undo</button>
      {/if}
    </p>
    <p class={["flex items-center", !(updates.stranded || newWaiting) && "sr-only"]}>
      <span role="status">{updates.stranded ? STRANDED_MESSAGE : newWaiting ? newItemsMessage(touch) : ""}</span>
      {#if updates.stranded}
        <button type="button" onclick={() => location.reload()} class="ml-2 min-h-11 min-w-11 font-semibold text-ink underline underline-offset-4"
          >Reload</button
        >
      {:else if newWaiting && touch}
        <!-- No r key on a touch screen, and Refresh sits in the More menu: the note offers to show them. -->
        <button type="button" onclick={() => refresh()} aria-label="Show new articles" class="ml-2 min-h-11 min-w-11 font-semibold text-ink underline underline-offset-4"
          >Show</button
        >
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
  /*
    The source, time and star on one line (decision 0048): the source shrinks
    and ends in "…"; the time and the star keep their room. Figures are
    proportional, as in running text, so the digits in a name and a date set
    as tightly as they do in the sidebar.
  */
  .row-meta {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.35em;
    white-space: nowrap;
    font-variant-numeric: proportional-nums;
  }
  .row-feed {
    display: flex;
    min-width: 0;
    flex: 0 1 auto;
  }
  /* Its box is narrowed to the letters shown and the "…" (hug.ts), so the "·" after it never drifts. */
  .row-feed-name {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row-date,
  .row-muted,
  .row-episode,
  .row-star {
    flex: none;
  }
  .row-episode {
    display: flex;
    align-items: center;
  }
  .row-star {
    display: flex;
    /* Green, as a filled star is (decision 0057); the shape says it too. */
    color: var(--star);
  }
</style>
