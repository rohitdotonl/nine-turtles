<!--
  The reading area (SPEC section 7): the article exactly as the publisher's
  feed gives it, cleaned by nine turtles and restyled in the reader's font and
  size. A quiet bar of icons sits at the top of the pane, anchored
  to its edges (decision 0038), each named in its tooltip (with its key) and
  to screen readers, together at the right (decision 0050), and on a computer it scrolls
  away with the title, Save and View original waiting again at the end (decision 0263): View original, Share (Copy link
  on a computer), Save, Write back (a paper plane, for a person only, decision 0214) and More (…).
  More holds Text and page (the reading panel), Mark unread, Add a note and Hide, each with its icon
  (SPEC sections 7, 8, 9, 21, 33 and 37; decision 0293); on a phone it opens upwards, Text
  and page nearest the button (decision 0243). Write back also ends the article.
  The writer's name under the title opens the page about them (decision
  0214), as their name at the top of the list does. What was just done ("Link copied.")
  floats at the pane's foot on a computer, as the list's note does. The source is always credited and linked. A feed that gives only a summary
  shows the summary, then a small centred note under the closing rule that
  links the whole article on the publisher's site; nine turtles never fetches
  the rest. A YouTube video plays above its text in YouTube's own player,
  loaded only once you press Play (decision 0072). A podcast episode has its
  player there instead, playing the publisher's own file (decision 0113). A
  picture shown clearly smaller than it really is opens larger on a sheet of
  its own (decision 0107).

  On a phone (SPEC section 20) the article is a screen of its own: the top
  bar has the back button, labeled with the list's name, and View original;
  Previous, Next, Share, Save, Write back (for a person) and More sit as icons in a toolbar at the bottom,
  within thumb reach, above a hairline; one that can't act is faded in place.
  A tap on the text puts both bars away, and another brings them back (bars.svelte.ts).
-->
<script lang="ts">
  import { copyOriginal, shareOriginal, sharing } from "./articleLinks";
  import { authorBesides, titleLength } from "./byline";
  import Portrait from "./Portrait.svelte";
  import { picturesOf } from "./portrait";
  import { edge } from "./edge";
  import { rightToLeft, scriptFamily } from "./scripts";
  import Icon from "./Icon.svelte";
  import ArticleSwipe from "./ArticleSwipe.svelte";
  import TextButton from "./TextButton.svelte";
  import LateLine from "./LateLine.svelte";
  import AwayNote from "./AwayNote.svelte";
  import EndTools from "./EndTools.svelte";
  import type { ListNote } from "./listNote";
  import MoreMenu, { type MenuGroup } from "./MoreMenu.svelte";
  import ReadingPanel from "./ReadingPanel.svelte";
  import YouTubePlayer from "./YouTubePlayer.svelte";
  import EpisodePlayer from "./EpisodePlayer.svelte";
  import WriteBack from "./WriteBack.svelte";
  import { writesBack } from "./writeBack";
  import ArticleMarks from "./ArticleMarks.svelte";
  import FootnoteCard from "./FootnoteCard.svelte";
  import { followAnchors, type Footnote } from "./footnotes";
  import { setPunctuation, setsEnglishPunctuation } from "./punctuation";
  import type { LoadedLibrary } from "./library.svelte";
  import { isSomeone, placesOf, siteName } from "./people";
  import { tick, type Snippet } from "svelte";
  import { chapters, foldable, youtubeVideo } from "./youtube";
  import { player, seek } from "./player.svelte";
  import type { Preferences } from "./preferences";
  import type { Article, FullArticle } from "./shapes";
  import { articleNow, readArticle } from "./articles";
  import { date, exactly, when } from "./times";
  import { goTo, keepPlace, placeIn, placeOf, type Place } from "./places";
  import { articleOpened, placeKept } from "./resume.svelte";
  import { connection } from "./connection.svelte";
  import { EPISODE_OFFLINE, NOT_KEPT } from "./offline";
  import PictureSheet from "./PictureSheet.svelte";
  import { OPENABLE, markPicture } from "./pictures";
  import { markEmbedded, markMissing, markWide } from "./missing";
  import { Bars } from "./bars.svelte";
  import { keyFor, tip } from "./keyboard";
  import { addressFor, ownClick } from "./router";

  let {
    article,
    heading = $bindable(),
    preferences = $bindable(),
    phone,
    back,
    onStar,
    onMarkUnread,
    onHide,
    onWriter,
    onAbout,
    beforeToolbar,
    library,
    listNote,
  }: {
    /** The article chosen in the list; its title, source and time show at once. */
    article: Article;
    heading?: HTMLHeadingElement;
    /** The reader's own controls, which the Aa panel changes (Page is in Settings › Look and feel too). */
    preferences: Preferences;
    /** The list to go back to, by its name: on a phone's top bar, and on a computer at the start of the article's bar (decision 0275). */
    back?: { name: string; onBack: () => void };
    /** On a phone-narrow window: moving to the previous or next article. */
    phone?: { onPrevious: () => void; onNext: () => void; previous?: Article; next?: Article };
    onStar: () => void;
    onMarkUnread: () => void;
    /** "Hide articles about…": Settings › Hiding, with a new rule for whoever wrote it (SPEC section 27). */
    onHide: (feed: number) => void;
    /** The writer's name under the title: their list, everything of theirs (their row's place, `library.rowOf`). */
    onWriter: (row: number) => void;
    /** "Info about …" in More (and `i`): the page about them. */
    onAbout: (row: number) => void;
    /** On a phone, the "now playing" bar, which sits above the article's toolbar (SPEC section 35). */
    beforeToolbar?: Snippet;
    /** The reader's people, for writing back to whoever wrote it (SPEC section 37). */
    library: LoadedLibrary;
    /** The list's note, drawn here as the list isn't on screen while an article is (decision 0229). */
    listNote?: ListNote;
  } = $props();

  /** Write back, at the article's end; the paper plane and `w` start it too. */
  let writeBack: WriteBack | undefined = $state();
  /** Write back's "Opening your email app…", at the reading area's foot when it was started away from the article's end. */
  let writeBackNote: ListNote | undefined = $state();
  /** Write back asked for before the article's text arrived (from a row's menu): it starts once it's there. */
  let writeBackFor: number | undefined = $state();
  $effect(() => {
    // Asked for about another article, left before it arrived: never started later by itself.
    if (writeBackFor !== undefined && writeBackFor !== article.id) writeBackFor = undefined;
    if (writeBack && writeBackFor === article.id) {
      writeBackFor = undefined;
      void tick().then(() => writeBack?.start());
    }
  });
  let followed = $derived(library.feeds?.some((feed) => feed.id === article.feedId) ?? false);
  let source = $derived(library.feeds?.find((feed) => feed.id === article.feedId));
  /** Someone to write back to: a person followed, never a publication (decision 0192). */
  let writable = $derived(writesBack(library.feeds?.find((feed) => feed.id === article.feedId)));

  // Bumped when an article arrives from the server, so the page looks again.
  let arrivals = $state(0);
  let problem = $state(false);
  let copied = $state("");
  /** On a computer, what was just done floats at the pane's foot, as the list's note does, since the top bar scrolls away (decision 0263). */
  const said: ListNote | undefined = $derived(!phone && copied ? { words: copied, close: () => (copied = "") } : undefined);
  // A list note that arrives puts the older line away, so the newest (an Undo) shows.
  $effect(() => void (listNote && (copied = "")));
  /** A name set apart (Unicode's first-strong isolate), so a right-to-left one keeps the print credit's commas in order. */
  const apart = (name: string) => `${String.fromCodePoint(0x2068)}${name}${String.fromCodePoint(0x2069)}`;
  let scroller: HTMLDivElement | undefined = $state();
  /** On a phone, a tap on the text puts the bars away and back (decision 0242). */
  const bars = new Bars();
  let topBar: HTMLDivElement | undefined = $state();
  let toolbar: HTMLDivElement | undefined = $state();
  /** The article's own text, whose blocks mark your place in it. */
  let text: HTMLDivElement | undefined = $state();
  /** The open arrow, kept hidden for the notes inside the text to draw (missing.ts). */
  let arrow: HTMLSpanElement | undefined = $state();
  /** The article itself: a footnote's card is placed in it. */
  let column: HTMLElement | undefined = $state();
  /** The reading panel (Text and page, in More), and the More menu it opens from (there's one, on the top bar or the phone's bottom bar). */
  let panelOpen = $state(false);
  let moreAnchor: HTMLSpanElement | undefined = $state();
  /** Where the keyboard goes back to: More, on the top bar or the phone's bottom bar. */
  function closePanel(giveBack: boolean) {
    panelOpen = false;
    if (giveBack) (phone ? toolbar : moreAnchor)?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')?.focus();
  }

  /** A YouTube video plays above the text, in YouTube's own player, once you press Play (decision 0072). */
  let video = $derived(youtubeVideo(article.link));

  let full: FullArticle | undefined = $derived.by(() => {
    void arrivals;
    return articleNow(article.id);
  });
  /** Right-to-left writing reads right to left: the title and the text share the right edge (decision 0223). */
  let rtl = $derived(rightToLeft(full?.language));
  /** Where "Read the rest on …" goes, by the site's own name ("Garden Letters", not the person's), else its address. */
  let site = $derived(library.feeds?.find((feed) => feed.id === article.feedId)?.siteTitle ?? siteName(full?.siteUrl ?? null) ?? article.feedTitle);
  let author = $derived(authorBesides(full?.author, article.feedTitle));

  /** A long video description shows its first paragraph, the rest behind "Show the full description" (decision 0144). */
  let unfoldedFor: number | undefined = $state();
  let folded = $derived(unfoldedFor !== article.id && video !== undefined && foldable(full?.content));

  /** A podcast's episode (SPEC section 35): its audio, played from the publisher's own address. Copies kept before podcasts have none. */
  let episode = $derived(full?.audio ?? null);
  /** The reader's highlights and note (SPEC section 42), and the video's player, whose time a note can start with. */
  let marks: ArticleMarks | undefined = $state();
  let youtube: YouTubePlayer | undefined = $state();
  let media = $derived(
    video && youtube
      ? { now: () => youtube?.now() ?? null, jump: (at: number) => youtube?.jump(at) }
      : episode
        ? { now: () => (player.current?.article.id === article.id ? player.position : null), jump: (at: number) => player.current?.article.id === article.id && seek(at) }
        : undefined,
  );

  /**
   * The article's less frequent actions, behind More (…), each with its icon before its words (decision 0293):
   * the reading panel, marking it unread, a note, and, apart, the writer's page and hiding others like it.
   */
  let more: MenuGroup[] = $derived([
    {
      items: [
        { label: "Text and page", icon: "aa" as const, onSelect: () => (panelOpen = true) },
        { label: "Mark unread", icon: "dot" as const, shortcut: phone ? undefined : keyFor("mark-unread"), onSelect: onMarkUnread },
        ...(full ? [{ label: "Add a note…", icon: "note" as const, shortcut: phone ? undefined : keyFor("note"), onSelect: () => act("note") }] : []),
      ],
    },
    // Who wrote it, apart: the page about them, and hiding articles about them (decision 0289).
    ...(followed ? [{ items: [
      { label: `Info about ${article.feedTitle}`, icon: "person" as const, shortcut: phone ? undefined : keyFor("about"), onSelect: () => onAbout(library.rowOf(article.feedId)) },
      { label: "Hide articles about…", icon: "eye-off" as const, onSelect: () => onHide(article.feedId) },
    ] }] : []),
  ]);

  // Your place, like a bookmark (decision 0060). Only the reader's own
  // scrolling moves it: opening an article, or putting it back at its
  // place, never does. It is written down a moment after scrolling stops,
  // and at once when another article opens.
  let moved = false;
  const SCROLL_KEYS = new Set([" ", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);
  let latest: { id: number; place: Place | undefined } | undefined;
  let writing: ReturnType<typeof setTimeout> | undefined;

  function writePlace() {
    clearTimeout(writing);
    writing = undefined;
    if (latest) {
      keepPlace(latest.id, latest.place);
      // The latest is also where you left off, offered on every device (decision 0175).
      placeKept(latest.id, latest.place);
    }
    latest = undefined;
  }

  function scrolled() {
    if (phone && scroller) bars.scrolled(scroller);
    // On a computer, the reading panel goes once More has scrolled away with the bar (decision 0263).
    if (panelOpen && !phone && scroller && moreAnchor && moreAnchor.getBoundingClientRect().bottom < scroller.getBoundingClientRect().top) closePanel(false);
    if (!moved || !scroller || !text) return;
    latest = { id: article.id, place: placeIn(scroller, text) };
    clearTimeout(writing);
    writing = setTimeout(writePlace, 400);
  }

  $effect(() => writePlace);

  $effect(() => {
    const area = scroller;
    if (!area || !phone) return;
    const tapped = (event: MouseEvent) => bars.tap(event, area, topBar, toolbar);
    // Before anything open closes on the same press (menus close on pointerdown).
    const pressed = () => bars.pressed();
    area.addEventListener("click", tapped);
    document.addEventListener("pointerdown", pressed, { capture: true });
    return () => {
      area.removeEventListener("click", tapped);
      document.removeEventListener("pointerdown", pressed, { capture: true });
    };
  });

  // A wheel, a touch or a press (the scroll bar too), and a key that scrolls (below): the reader is moving through the article themselves.
  $effect(() => {
    const area = scroller;
    if (!area) return;
    const mine = () => (moved = true);
    const kinds = ["wheel", "touchstart", "pointerdown"] as const;
    for (const kind of kinds) area.addEventListener(kind, mine, { passive: true });
    return () => {
      for (const kind of kinds) area.removeEventListener(kind, mine);
    };
  });

  $effect(() => {
    const id = article.id;
    writePlace();
    articleOpened(id);
    moved = false;
    problem = false;
    copied = "";
    bars.show();
    // A new article starts at its top, unless you stopped part of the way through it (below).
    if (scroller) scroller.scrollTop = 0;
    if (articleNow(id)) return;
    fetchArticle(id);
  });

  /** Try again: the button goes as the article is asked for again, so the keyboard waits on its title. */
  function retryArticle() {
    heading?.focus({ preventScroll: true });
    fetchArticle(article.id);
  }

  /** Asks for the article's text; if it can't come, the reading area says so, with Try again. */
  function fetchArticle(id: number) {
    problem = false;
    readArticle(id).then(
      () => arrivals++,
      () => {
        if (article.id === id) problem = true;
      },
    );
  }

  // Opening an article you stopped part of the way through puts you back
  // where you were, at once. Pictures that load late push the text down, so
  // the place is kept steady for a few seconds, until you scroll yourself.
  $effect(() => {
    const area = scroller;
    const body = text;
    const id = article.id;
    if (!area || !body) return;
    const place = placeOf(id);
    if (!place) return;
    goTo(area, body, place);
    const steady = new ResizeObserver(() => {
      if (!moved) goTo(area, body, place);
    });
    steady.observe(body);
    const done = setTimeout(() => steady.disconnect(), 5000);
    return () => {
      steady.disconnect();
      clearTimeout(done);
    };
  });

  // Footnotes: a footnote's number opens its note in a card just under the
  // line (FootnoteCard, decision 0247); any other link to a place inside the
  // article scrolls there (footnotes.ts). A new article closes the card.
  let footnote: { note: Footnote; top: number; link: HTMLAnchorElement } | undefined = $state();
  $effect(() => {
    if (!scroller) return;
    return followAnchors(scroller, (note, link) => {
      if (column) footnote = { note, top: link.getBoundingClientRect().bottom - column.getBoundingClientRect().top + 4, link };
    });
  });
  $effect(() => {
    void article.id;
    footnote = undefined;
  });

  // An English article's typewriter marks set properly as it's shown: curly
  // quotes, dashes, ellipses (punctuation.ts, decision 0247).
  $effect(() => {
    if (text && setsEnglishPunctuation(full?.language)) setPunctuation(text);
  });

  // The article's own links open in a new tab (cleaned so by nine turtles);
  // each tells a screen reader so, as every link out of nine turtles does.
  $effect(() => {
    for (const link of text?.querySelectorAll('a[target="_blank"]') ?? []) link.setAttribute("aria-describedby", "new-tab-note");
  });

  // Pictures that open larger (decision 0107): one the page shows clearly
  // smaller than it really is, once it has loaded, and not inside a link,
  // becomes a button. Looked at again whenever a picture loads or changes
  // size (the window or the text size changing).
  let opened: { src: string; alt: string; picture: HTMLImageElement } | undefined = $state();

  $effect(() => {
    const body = text;
    void full?.content;
    void full?.summary;
    if (!body) return;
    const pictures = () => body.querySelectorAll("img");
    // A table wider than the column says so under it, with a word for a touch screen (decision 0260).
    const touch = matchMedia("(pointer: coarse)").matches;
    // An embedded frame, an empty link from the server, gets its note (decision 0260).
    body.querySelectorAll<HTMLAnchorElement>("a.embed-note").forEach((link) => markEmbedded(link, arrow?.firstElementChild));
    const look = () => {
      pictures().forEach(markPicture);
      body.querySelectorAll("table").forEach((table) => markWide(table, touch));
    };
    const sizes = new ResizeObserver(look);
    sizes.observe(body);
    pictures().forEach((image) => sizes.observe(image));
    // A picture that didn't load leaves a note with a link to the original instead (decision 0260).
    const broken = (event: Event) => {
      if (event.target instanceof HTMLImageElement && body.contains(event.target)) markMissing(event.target, article.link, arrow?.firstElementChild);
    };
    // A picture's load doesn't bubble; listening on the way down catches each one.
    body.addEventListener("load", look, true);
    body.addEventListener("error", broken, true);
    const press = (event: MouseEvent | KeyboardEvent) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.classList.contains(OPENABLE)) return;
      if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
      // Enter and Space open the picture, rather than scrolling or opening an article.
      event.preventDefault();
      opened = { src: image.currentSrc || image.src, alt: image.alt, picture: image };
    };
    body.addEventListener("click", press);
    body.addEventListener("keydown", press);
    look();
    return () => {
      sizes.disconnect();
      body.removeEventListener("load", look, true);
      body.removeEventListener("error", broken, true);
      body.removeEventListener("click", press);
      body.removeEventListener("keydown", press);
    };
  });

  // Another article closes an opened picture.
  $effect(() => {
    void article.id;
    opened = undefined;
  });

  /**
   * Closing the opened picture gives the keyboard back to it in the article,
   * or to the article's title if it no longer opens larger (the window
   * changed size meanwhile), so the keyboard never lands on the page itself.
   */
  function closePicture() {
    const picture = opened?.picture;
    opened = undefined;
    if (picture?.isConnected && picture.classList.contains(OPENABLE)) picture.focus({ preventScroll: true });
    else heading?.focus({ preventScroll: true });
  }

  /** Phones get the system's share sheet; computers get Copy link (SPEC section 21). */
  function share() {
    return sharing ? shareOriginal(article) : copyLink();
  }

  /**
   * `c`, and Copy link in More: the original's address goes on the
   * clipboard, and the top bar says so. On a phone with a keyboard too, `c`
   * copies rather than opening the share sheet.
   */
  export async function copyLink() {
    const link = article.link;
    if (!link) return;
    // Emptied first, so the same words are said again for a second copy.
    copied = "";
    copied = await copyOriginal(link);
  }

  /**
   * `w`, and the paper plane: the reader's email app, or the box asking
   * for the writer's address. `h`: the words chosen are highlighted.
   * N, and Add a note… in More: a note on them, or on the whole article (SPEC section 42).
   */
  export function act(what: "write-back" | "highlight" | "note") {
    if (what === "write-back") {
      if (writeBack) void writeBack.start();
      else writeBackFor = article.id;
    } else if (what === "highlight") marks?.highlight();
    else marks?.note();
  }

  /**
   * Space and Shift+Space: the article moves on (1) or back (-1) by a screen,
   * keeping a few lines of the last one in view so the eye finds its place,
   * at once, never gliding. At the end (or the top) it simply stops.
   */
  export function page(step: 1 | -1) {
    const area = scroller;
    if (!area) return;
    moved = true;
    const overlap = Math.min(64, area.clientHeight * 0.15);
    area.scrollBy({ top: step * Math.max(area.clientHeight - overlap, 40), behavior: "instant" });
  }
</script>

{#snippet shareButton(style: string)}
  <!-- Share, one press from the text (decision 0293): the phone's own share menu, or Copy link where there's none. -->
  <button
    type="button"
    aria-label={sharing ? "Share" : "Copy link"}
    title={sharing ? "Share" : phone ? "Copy link" : tip("Copy link", "copy-link")}
    aria-keyshortcuts={phone || sharing ? undefined : keyFor("copy-link")}
    aria-disabled={!article.link}
    onclick={() => article.link && share()}
    class={style}><Icon name="share" size="alone" /></button
  >
{/snippet}

{#snippet saveIcon()}
  <!-- Filled when saved, an outline when not: the shape says it, not only the color. -->
  <Icon name="bookmark" size="alone" filled={article.starred} />
{/snippet}

{#snippet writeBackButton(style: string)}
  <!-- Write back, one press from the text (decision 0214): a paper plane, for a person only. -->
  <button type="button" aria-label="Write back" title={phone ? "Write back" : tip("Write back", "write-back")} onclick={() => act("write-back")} class={style}><Icon name="send" size="alone" /></button>
{/snippet}

{#snippet original()}
  <a href={article.link} target="_blank" rel="noopener noreferrer" aria-label="View original" aria-describedby="new-tab-note" title={phone ? "View original" : tip("View original", "open-original")} class="btn-quiet btn-icon"
    ><Icon name="open" size="alone" /></a
  >
{/snippet}

<!-- A key that scrolls: the reader is moving through the article themselves. -->
<svelte:window onkeydown={(event) => SCROLL_KEYS.has(event.key) && (moved = true)} />

<section aria-label="Article" class="flex min-w-0 flex-1 flex-col bg-paper">
  <span id="new-tab-note" hidden lang="en">Opens in a new tab</span>
  <!-- The open arrow the notes inside the text draw beside their links (missing.ts). -->
  <span bind:this={arrow} hidden><Icon name="open" /></span>
  <!--
    A phone's top bar is solid, in the page's own color, across the whole pane, and no text shows through it;
    a faint line shows under it only once the text has scrolled (the scroller's own top edge, as in the list).
  -->
  {#if phone}
    <!-- The back button, labeled with the list's name, on the left; the way to the publisher on the right. -->
    <!-- Put away (decision 0242), it's still there for screen readers and Tab, which brings it back. -->
    <div bind:this={topBar} onfocusin={() => bars.show()} class={bars.away ? "sr-only" : "reading-bar pane-bar nav-bar relative z-10 gap-2"}>
      <button type="button" onclick={back?.onBack} aria-label="Back to {back?.name}" title="Back to {back?.name}" data-behind="list-pane" class="btn-quiet nav-back min-w-0 shrink"
        ><Icon name="back" size="alone" /><span class="truncate">{back?.name}</span></button
      >
      <p role="status" class="line-clamp-2 min-w-0 flex-1 text-center text-meta empty:sr-only">{copied}</p>
      {#if article.link}
        <span class="ml-auto">{@render original()}</span>
      {/if}
    </div>
  {/if}

  <div
    use:edge
    bind:this={scroller}
    onscroll={scrolled}
    style:padding-top={bars.away ? `${bars.room.above}px` : undefined}
    style:padding-bottom={bars.away ? `${bars.room.below}px` : undefined}
    class={["reading-scroller scroll-gutter relative min-h-0 flex-1 overflow-y-auto bg-paper px-5 md:px-16", phone && "scroller", listNote || writeBackNote || said ? "pb-24" : "pb-8" /* room under the article's end for the floating note (decision 0229) */]}>
    {#if !phone}
      <!--
        On a computer the bar is the article's first line and scrolls away with its title (decision 0263):
        quiet icons, each named in its tooltip with its key, in one cluster at the right, 4px apart: the way to the
        publisher, then the reader's own tools. It stands over the text column, its way back on the text's left edge and its last icon on its right edge (decision 0277, replacing 0050).
      -->
      <div class="reading-bar pane-bar over-text relative z-10 -mx-5 gap-2 px-2 md:-mx-16">
        {#if back}<button type="button" onclick={back.onBack} aria-label="Back to {back.name}" title="Back to {back.name} (Esc)" data-behind="list-pane" class="btn-quiet nav-back min-w-0 shrink text-ink-2"><Icon name="back" size="alone" /><span class="truncate">{back.name}</span></button>{/if}
        {#if !article.link}
          <p class="px-2 text-meta text-muted">This article has no link to its original.</p>
        {/if}
        <div class="ml-auto flex items-center gap-1">
          {#if article.link}
            {@render original()}
          {/if}
          {#if article.link}{@render shareButton("btn-quiet btn-icon")}{/if}
          <!-- A toggle keeps one name for screen readers ("Save", pressed or not); the filled bookmark shows its state. -->
          <button type="button" aria-label="Save" aria-pressed={article.starred} title={tip(article.starred ? "Remove from Saved" : "Save", "star")} onclick={onStar} class={["btn-quiet btn-icon", article.starred && "text-ink"]}>
            {@render saveIcon()}
          </button>
          {#if writable}{@render writeBackButton("btn-quiet btn-icon")}{/if}
          <span bind:this={moreAnchor} class="inline-flex"><MoreMenu id="article-menu" label="More actions" groups={more} /></span>
        </div>
      </div>
    {/if}
    <!-- Right-to-left writing (Arabic, Hebrew…) reads right to left, title and text on one right edge (decision 0223). -->
    <article bind:this={column} lang={full?.language ?? undefined} data-script={scriptFamily(full?.language)} class={["article relative pt-3", rtl && "rtl"]}>
      <!-- Centred, as a book opens a chapter, and sized by its length: a short title large, a long one smaller with looser lines (decision 0294). -->
      <h2 tabindex="-1" bind:this={heading} class={["article-title", titleLength(article.title || "Untitled")]} dir={rtl ? "rtl" : undefined}>{article.title || "Untitled"}</h2>
      <!-- Under the title, centred, as on a book's title page: their picture, "by" and their name, then the day, small and faint (decision 0294). -->
      <!-- Their picture leads the byline (decision 0285): the one the reader chose, else their feed's, else their site's icon, else initials. -->
      <div class="article-credit">
        <Portrait name={article.feedTitle} pictures={picturesOf(source ? placesOf(source, library.feeds ?? []) : [], full?.siteUrl)} person={isSomeone(source)} beside />
        <!-- Left to right whatever the article's script, as the byline always was. -->
        <p class="article-byline min-w-0" lang="en" dir="ltr">
          <span class="by">by</span>{" "}{#if author}<bdi>{author}</bdi>{" "}<span class="by">in</span>{" "}{/if}{#if followed}
            <!-- Someone followed: their name opens their list, everything of theirs (decision 0289); the page about them is a press on from there, or More's "Info about …". No "›" here.
                 A link, not a button, so a long name wraps as the words around it do and the line stays one sentence (decision 0260). -->
            <a class="publisher writer-link" href={addressFor({ kind: "feed", id: library.rowOf(article.feedId) })} title={`Everything by ${article.feedTitle}`} aria-describedby="byline-about"
              onclick={(event) => ownClick(event) && onWriter(library.rowOf(article.feedId))}><bdi>{article.feedTitle}</bdi></a
            ><span id="byline-about" aria-hidden="true" class="sr-only">Opens everything of theirs.</span>
          {:else if full?.siteUrl}
            <a href={full.siteUrl} target="_blank" rel="noopener noreferrer" class="publisher hover:underline hover:underline-offset-4"><bdi>{article.feedTitle}</bdi><span class="sr-only">{" "}(opens in a new tab)</span></a>
          {:else}
            <span class="publisher"><bdi>{article.feedTitle}</bdi></span>
          {/if}<span class="sr-only">,</span>
          <!-- The day on a line of its own, small and faint, so the name leads (decision 0294). -->
          <time datetime={new Date(article.at * 1000).toISOString()} title={exactly(article.at)}>{when(article.at)}</time>
        </p>
      </div>

      {#if video && connection.offline}
        <!-- Without a connection there's no player to load: the video waits, as images do (SPEC section 32). -->
        <p class="article-note mt-6" lang="en">The video plays here when you're back online.</p>
      {:else if video}
        {#key article.id}
          <YouTubePlayer
            bind:this={youtube}
            id={article.id}
            {video}
            title={article.title || "Untitled"}
            tall={full?.videoKind === "short" || article.link?.includes("/shorts/")}
            chapters={chapters(full?.content)}
          />
        {/key}
      {/if}
      {#if episode && connection.offline && !(player.current?.article.id === article.id)}
        <!-- Without a connection there's nothing to play from: the episode waits, as a video does (SPEC section 32). -->
        <p role="status" class="article-note mt-6" lang="en">{EPISODE_OFFLINE}</p>
      {:else if episode}
        <!-- A podcast's episode plays here, from the publisher's own file (SPEC section 35, decision 0113). -->
        {#key article.id}
          <EpisodePlayer {article} {episode} />
        {/key}
      {/if}
      {#if full}
        {#if full.content}
          <!-- Cleaned by nine turtles before it was stored (server/src/feed/clean.rs). -->
          <!-- Made anew for each article: highlights are drawn into it (ArticleMarks). -->
          {#key full.id}
            <div bind:this={text} id="article-text" class={["article-text", folded && "folded"]} dir={rtl ? "rtl" : "auto"}>{@html full.content}</div>
          {/key}
          {#if video && foldable(full.content)}
            <button type="button" class="text-link" aria-expanded={!folded} aria-controls="article-text" lang="en" onclick={() => (unfoldedFor = folded ? article.id : undefined)}
              >{folded ? "Show the full description" : "Show less"}</button
            >
          {/if}
          {#if footnote}
            <FootnoteCard note={footnote.note} top={footnote.top} onclose={(back) => { if (back) footnote?.link.focus(); footnote = undefined; }} />
          {/if}
          <!-- The last page: a short rule, so the article ends rather than stops. -->
          <hr aria-hidden="true" class="article-end" />
        {:else if full.summary}
          {#key full.id}
            <div bind:this={text} class="article-text" dir={rtl ? "rtl" : "auto"}>{@html full.summary}</div>
          {/key}
          <hr aria-hidden="true" class="article-end" />
          <!--
            End matter, under the closing rule as in a book: where the rest of it is. The sentence, then the
            link to the publisher on a row of its own, 44px tall to press: "Read the rest on {publisher} ↗", or for a
            podcast's episode "Read the episode page on {publisher} ↗" (SPEC sections 7 and 35; decision 0218). The sentence
            and the link each stay whole wherever they fit on a line, so a narrow column never strands a word
            (decision 0044).
          -->
          <p class="article-note" lang="en">
            <span>Only the beginning is shared here.</span>{#if article.link}{" "}<a href={article.link} target="_blank" rel="noopener noreferrer" class="gap-[0.25em]"
                >{episode ? "Read the episode page on" : "Read the rest on"} {site}<Icon name="open" /><span class="sr-only">{" "}(opens in a new tab)</span></a
              >{/if}
          </p>
        {:else if video || episode}
          <hr aria-hidden="true" class="article-end" />
        {:else}
          <p class="mt-6" lang="en">This article has no text in its feed. View original to read it on the publisher's site.</p>
        {/if}
      {:else if problem}
        <p role="status" class="mt-6 flex flex-wrap items-center gap-x-2" lang="en">
          {#if connection.offline}{NOT_KEPT}{:else}This article couldn't be loaded.
            <TextButton onclick={retryArticle}>Try again</TextButton>{/if}
        </p>
      {:else}
        <!-- Its text still on its way: after half a second a line says so, under the byline (decision 0230). -->
        {#key article.id}<LateLine class="mt-6 font-serif text-muted" words="Loading the article…" />{/key}
      {/if}
      {#if full}
        <!-- The article's last word is the reader's: their highlights and note (SPEC section 42), then writing back to whoever wrote it (SPEC section 37). -->
        {#key full.id}
          <ArticleMarks
            bind:this={marks}
            {article}
            {full}
            {text}
            phone={phone !== undefined}
            {media}
            say={(words) => (copied = words)}
            writeBack={writable ? (quote) => void writeBack?.start([quote]) : undefined}
          />
        {/key}
        {#if !phone}<EndTools starred={article.starred} {onStar} original={(full.content || !full.summary) && article.link ? article.link : undefined} />{/if}
        <!-- Outlined, as Mark all as read ends a list: the way on, quieter than the writing (decision 0242); for someone who could be either, the question in its place (WriteBack, decision 0264). -->
        <WriteBack bind:this={writeBack} bind:away={writeBackNote} within={scroller} {article} comments={full?.commentsUrl} {library} quotes={() => marks?.quotes() ?? []} />
      {/if}
      <!-- Only on paper (print.css, decision 0236): where it came from, as a citation, with the original's address; drawn from data-credit, so it's never a second copy of the byline on screen. -->
      <p class="print-credit" lang="en" data-credit={`From ${apart(article.feedTitle)}${author ? `, by ${apart(author)}` : ""}, ${date(article.at)}.${article.link ? ` The original: ${article.link}` : ""}`}></p>
    </article>
  </div>

  <!-- Write back's own note comes first while it's there: it answers the press just made (SPEC section 37). -->
  <AwayNote note={writeBackNote ?? said ?? listNote} onGone={() => heading?.focus({ preventScroll: true })} />
  {#if phone && beforeToolbar}
    {@render beforeToolbar()}
  {/if}
  {#if phone}
    <ArticleSwipe area={scroller} previous={phone.previous} next={phone.next} onPrevious={phone.onPrevious} onNext={phone.onNext} />
    <!--
      Within thumb reach: quiet icons, each named for screen readers, above a
      hairline so the text ends at an edge rather than being sliced. Two
      groups by job, in order of use (decision 0225): what you do to this
      article on the left, the rarest furthest out (More, Share, Write back,
      Save), then a short hairline, then moving through the list at the
      right, where a right thumb rests (Previous, Next). Previous on the
      first article (or Next on the last) keeps its arrow and its place,
      faded, as iOS dims a toolbar button, so the bar never shows a hole; it
      says "dimmed" to screen readers and does nothing (decision 0047).
    -->
    <div bind:this={toolbar} role="group" aria-label="Article actions" onfocusin={() => bars.show()} class={bars.away ? "sr-only" : "toolbar relative z-10 flex shrink-0 bg-paper px-1 pb-[env(safe-area-inset-bottom)]"}>
      <!-- Text and page and the rest, in a menu that opens upwards, nearest the button first (decision 0243). -->
      <MoreMenu id="article-menu" label="More actions" groups={more} up start />
      {@render shareButton("")}
      {#if writable}{@render writeBackButton("")}{/if}
      <button type="button" aria-label="Save" aria-pressed={article.starred} onclick={onStar} class:text-ink={article.starred}>
        {@render saveIcon()}
      </button>
      <span aria-hidden="true" class="toolbar-rule"></span>
      <button type="button" aria-label="Previous" aria-disabled={!phone.previous} onclick={() => phone.previous && phone.onPrevious()}>
        <Icon name="chevron-up" size="alone" />
      </button>
      <button type="button" aria-label="Next" aria-disabled={!phone.next} onclick={() => phone.next && phone.onNext()}>
        <Icon name="chevron-down" size="alone" />
      </button>
    </div>
  {/if}

  {#if opened}
    <PictureSheet src={opened.src} alt={opened.alt} lang={full?.language ?? undefined} onClose={closePicture} />
  {/if}

  {#if panelOpen}
    <ReadingPanel bind:preferences anchor={moreAnchor} phone={phone !== undefined} onClose={closePanel} />
  {/if}
</section>

<style>
  /* A footnote or heading the keyboard moves to stops a little below the window's top. */
  .reading-scroller {
    scroll-padding-top: 1rem;
  }
  /* The top bar (decision 0040): solid, in the page's own color, never see-through or blurred. On a phone its hairline is the scroller's top edge (app.css → .scroller). */
  .reading-bar {
    background-color: var(--paper);
  }
  @media (forced-colors: active) {
    .reading-bar {
      background-color: Canvas;
    }
  }
  /*
    The phone's bottom toolbar: five equal places of quiet icons (six with
    Write back, for a person), each at
    least 44px square, in the second ink (a saved article's bookmark in full ink).
  */
  .toolbar {
    border-top: 1px solid var(--line);
  }
  .toolbar > :global(*) {
    display: flex;
    flex: 1 1 0;
    min-width: 2.75rem;
    min-height: 3.25rem;
    align-items: center;
    justify-content: center;
    color: var(--ink-2);
  }
  .toolbar > :global(.text-ink) {
    color: var(--ink);
  }
  /* The hairline between the two groups: a mark, not a place to press. */
  .toolbar > .toolbar-rule {
    flex: none;
    min-width: 1px;
    width: 1px;
    min-height: 0;
    height: 1.5rem;
    align-self: center;
    margin-inline: 0.25rem;
    background: var(--strong);
  }
  /*
    One that can't act right now (Previous on the first article) stays in
    its place, its arrow faded, so the bar keeps its even places. A
    control that can't be used is exempt from contrast (WCAG 1.4.11), and
    it's named and said "dimmed" to screen readers, not shown by color alone.
  */
  .toolbar > [aria-disabled="true"] {
    cursor: default;
  }
  /* Only the arrow fades: the keyboard's outline, if it lands here, stays solid. */
  .toolbar > [aria-disabled="true"] > :global(svg) {
    opacity: 0.35;
  }
  /* The writer's name under the title: a 44px target to touch, taller than its line without moving it
     (an inline link's padding above and below never moves the line, on each line a long name wraps onto). */
  /* Underlined at rest, as every link is (the 65% edge), so it reads as a way in; the line comes up to the ink under the pointer. */
  .writer-link {
    padding-block: calc((2.75rem - 1em) / 2);
    cursor: pointer;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 4px;
    text-decoration-color: color-mix(in srgb, currentColor 65%, transparent);
  }
  @media (hover: hover) {
    .writer-link:hover {
      text-decoration-color: currentColor;
    }
  }
  /* A long video description, folded: its first paragraph only, until "Show the full description" (decision 0144). */
  .folded > :global(:not(:first-child)) {
    display: none;
  }
</style>
