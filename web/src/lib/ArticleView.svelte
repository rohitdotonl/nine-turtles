<!--
  The reading area (SPEC section 7): the article exactly as the publisher's
  feed gives it, cleaned by nine turtles and restyled in the reader's font and
  size. A quiet bar of icons sits at the top of the pane, anchored
  to its edges (decision 0038), each named in its tooltip (with its key) and
  to screen readers, together at the right as Apple Books keeps its reading
  toolbar (decision 0050): View original, Aa (the reading panel), Star,
  Write back (a paper plane, for a person only, decision 0214) and More (…).
  More holds Copy link (Share on phones), Mark unread, Add a note and Hide
  (SPEC sections 7, 8, 9, 21, 33 and 37). Write back also ends the article.
  The writer's name under the title opens the page about them (decision
  0214), as their name at the top of the list does. The
  bar is solid, in the page's own color, above the scrolling text, with a
  hairline under it only once the text has scrolled (decision 0040). The
  source is always credited and linked. A feed that gives only a summary
  shows the summary, then a small centred note under the closing rule that
  links the whole article on the publisher's site; nine turtles never fetches
  the rest. A YouTube video plays above its text in YouTube's own player,
  loaded only once you press Play (decision 0072). A podcast episode has its
  player there instead, playing the publisher's own file (decision 0113). A
  picture shown clearly smaller than it really is opens larger on a sheet of
  its own (decision 0107).

  On a phone (SPEC section 20) the article is a screen of its own: the top
  bar has the back button, labeled with the list's name, and View original;
  Previous, Next, Aa, Star, Write back (for a person) and More sit as icons in a toolbar at the bottom,
  within thumb reach, above a hairline; one that can't act is faded in place.
-->
<script lang="ts">
  import { authorBesides } from "./leadOpening";
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import TextButton from "./TextButton.svelte";
  import MoreMenu, { type MenuGroup } from "./MoreMenu.svelte";
  import ReadingPanel from "./ReadingPanel.svelte";
  import YouTubePlayer from "./YouTubePlayer.svelte";
  import EpisodePlayer from "./EpisodePlayer.svelte";
  import WriteBack from "./WriteBack.svelte";
  import { writesBack } from "./writeBack";
  import ArticleMarks from "./ArticleMarks.svelte";
  import type { LoadedLibrary } from "./library.svelte";
  import { siteName } from "./people";
  import { tick, type Snippet } from "svelte";
  import { chapters, foldable, youtubeVideo } from "./youtube";
  import { player, seek } from "./player.svelte";
  import type { Preferences } from "./preferences";
  import type { Article, FullArticle } from "./shapes";
  import { articleNow, readArticle } from "./articles";
  import { when } from "./times";
  import { goTo, keepPlace, placeIn, placeOf, type Place } from "./places";
  import { articleOpened, placeKept } from "./resume.svelte";
  import { connection } from "./connection.svelte";
  import { EPISODE_OFFLINE, NOT_KEPT } from "./offline";
  import PictureSheet from "./PictureSheet.svelte";
  import { OPENABLE, markPicture } from "./pictures";
  import { keyFor, tip } from "./keyboard";

  let {
    article,
    heading = $bindable(),
    preferences = $bindable(),
    phone,
    toggles = 0,
    onStar,
    onMarkUnread,
    onHide,
    onWriter,
    beforeToolbar,
    library,
  }: {
    /** The article chosen in the list; its title, source and time show at once. */
    article: Article;
    heading?: HTMLHeadingElement;
    /** The reader's own controls, which the Aa panel changes (the same as Settings › Look and feel). */
    preferences: Preferences;
    /** On a phone-narrow window: the list to go back to, and moving to the previous or next article. */
    phone?: {
      back: string;
      onBack: () => void;
      onPrevious: () => void;
      onNext: () => void;
      hasPrevious: boolean;
      hasNext: boolean;
    };
    /** How many pane buttons sit at the start of the top bar (on a computer), to keep clear of. */
    toggles?: number;
    onStar: () => void;
    onMarkUnread: () => void;
    /** "Hide articles about…": Settings › Hiding, with a new rule for whoever wrote it (SPEC section 27). */
    onHide: (feed: number) => void;
    /** The writer's name under the title: the page about them (their row's place, `library.rowOf`). */
    onWriter: (row: number) => void;
    /** On a phone, the "now playing" bar, which sits above the article's toolbar (SPEC section 35). */
    beforeToolbar?: Snippet;
    /** The reader's people, for writing back to whoever wrote it (SPEC section 37). */
    library: LoadedLibrary;
  } = $props();

  /** Write back, at the article's end; the paper plane and `w` start it too. */
  let writeBack: WriteBack | undefined = $state();
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
  /** Someone to write back to: a person followed, never a publication (decision 0192). */
  let writable = $derived(writesBack(library.feeds?.find((feed) => feed.id === article.feedId)));

  // Bumped when an article arrives from the server, so the page looks again.
  let arrivals = $state(0);
  let problem = $state(false);
  let copied = $state("");
  let scroller: HTMLDivElement | undefined = $state();
  /** The article's own text, whose blocks mark your place in it. */
  let text: HTMLDivElement | undefined = $state();
  /** The Aa reading panel, and its button (there's one, on the top bar or the phone's bottom bar). */
  let panelOpen = $state(false);
  let aaButton: HTMLButtonElement | undefined = $state();

  function closePanel(giveBack: boolean) {
    panelOpen = false;
    if (giveBack) aaButton?.focus();
  }

  /** A YouTube video plays above the text, in YouTube's own player, once you press Play (decision 0072). */
  let video = $derived(youtubeVideo(article.link));

  let full: FullArticle | undefined = $derived.by(() => {
    void arrivals;
    return articleNow(article.id);
  });
  /** Where "Read on …" goes, by the site's own name ("Garden Letters", not the person's), else its address. */
  let site = $derived(library.feeds?.find((feed) => feed.id === article.feedId)?.siteTitle ?? siteName(full?.siteUrl ?? null) ?? article.feedTitle);
  let author = $derived(authorBesides(full?.author, article.feedTitle));

  /** A long video description shows its first paragraph, the rest behind "Show the full description" (decision 0144). */
  let unfoldedFor: number | undefined = $state();
  let folded = $derived(unfoldedFor !== article.id && video !== undefined && foldable(full?.content));

  /** Phones get the system's share sheet; computers get Copy link (SPEC section 21). */
  const sharing =
    typeof navigator.share === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;

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

  /** The article's less frequent actions, behind More (…): sharing its link, marking it unread, a note, and hiding others like it. */
  let more: MenuGroup[] = $derived([
    {
      items: [
        ...(article.link ? [{ label: sharing ? "Share" : "Copy link", shortcut: phone || sharing ? undefined : keyFor("copy-link"), onSelect: share }] : []),
        { label: "Mark unread", shortcut: phone ? undefined : keyFor("mark-unread"), onSelect: onMarkUnread },
        ...(full ? [{ label: "Add a note…", shortcut: phone ? undefined : keyFor("note"), onSelect: () => act("note") }] : []),
        ...(followed ? [{ label: "Hide articles about…", onSelect: () => onHide(article.feedId) }] : []),
      ],
    },
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
    if (!moved || !scroller || !text) return;
    latest = { id: article.id, place: placeIn(scroller, text) };
    clearTimeout(writing);
    writing = setTimeout(writePlace, 400);
  }

  $effect(() => writePlace);

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

  // Footnotes: a link to a place inside the article (cleaned to `#article-…`
  // by nine turtles) scrolls there and moves the keyboard's place with it,
  // rather than opening a new tab.
  $effect(() => {
    const area = scroller;
    if (!area) return;
    const followAnchor = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      const anchor = link?.getAttribute("href");
      if (!anchor?.startsWith("#article-")) return;
      event.preventDefault();
      const place = document.getElementById(decodeURIComponent(anchor.slice(1)));
      if (!place || !area.contains(place)) return;
      place.setAttribute("tabindex", "-1");
      place.scrollIntoView({ block: "start" });
      place.focus({ preventScroll: true });
    };
    area.addEventListener("click", followAnchor);
    return () => area.removeEventListener("click", followAnchor);
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
    const look = () => pictures().forEach(markPicture);
    const sizes = new ResizeObserver(look);
    sizes.observe(body);
    pictures().forEach((image) => sizes.observe(image));
    // A picture's load doesn't bubble; listening on the way down catches each one.
    body.addEventListener("load", look, true);
    body.addEventListener("error", look, true);
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
      body.removeEventListener("error", look, true);
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

  async function share() {
    const link = article.link;
    if (!link) return;
    if (sharing) {
      try {
        await navigator.share({ url: link, title: article.title });
      } catch {
        // Closing the share sheet without sharing is fine.
      }
      return;
    }
    await copyLink();
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
    try {
      await navigator.clipboard.writeText(link);
      copied = "Link copied.";
    } catch {
      copied = "The link couldn't be copied. Use View original and copy it from there.";
    }
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

{#snippet aa(size: number, style: string)}
  <!-- The reading panel's button: text size, theme and font, one press from the text. -->
  <button
    type="button"
    bind:this={aaButton}
    aria-label="Reading appearance"
    title="Reading appearance"
    aria-haspopup="dialog"
    aria-expanded={panelOpen}
    onclick={() => (panelOpen ? closePanel(false) : (panelOpen = true))}
    onkeydown={(event) => {
      // With the panel open and the keyboard on its button, Escape closes the panel first.
      if (event.key === "Escape" && panelOpen) {
        event.preventDefault();
        closePanel(true);
      }
    }}
    class={[style, panelOpen && "text-ink"]}
  >
    <!-- Open, the icon sits on a small rounded tone, like a pressed toolbar button. -->
    <span class={["flex size-9 items-center justify-center rounded-md", panelOpen && "bg-[var(--tone)]"]}><Icon name="aa" {size} /></span>
  </button>
{/snippet}

{#snippet starIcon(size: number)}
  <!-- Filled when starred, an outline when not: the shape says it, not only the color. -->
  <Icon name="star" {size} filled={article.starred} />
{/snippet}

{#snippet writeBackButton(size: number, style: string)}
  <!-- Write back, one press from the text (decision 0214): a paper plane, for a person only. -->
  <button type="button" aria-label="Write back" title={phone ? "Write back" : tip("Write back", "write-back")} onclick={() => act("write-back")} class={style}><Icon name="send" {size} /></button>
{/snippet}

{#snippet original(size: number)}
  <a href={article.link} target="_blank" rel="noopener noreferrer" aria-label="View original" aria-describedby="new-tab-note" title={phone ? "View original" : tip("View original", "open-original")} class="btn-quiet btn-icon"
    ><Icon name="open" {size} /></a
  >
{/snippet}

<!-- A key that scrolls: the reader is moving through the article themselves. -->
<svelte:window onkeydown={(event) => SCROLL_KEYS.has(event.key) && (moved = true)} />

<section aria-label="Article" class="flex min-w-0 flex-1 flex-col bg-paper">
  <span id="new-tab-note" hidden lang="en">Opens in a new tab</span>
  <!--
    The top bar is solid, in the page's own color, across the whole pane
    (scrollbar included), so its icons are anchored to the pane's edges
    rather than the text column, and no text shows through it. The text
    scrolls below it; a faint line shows between them only once the text
    has scrolled (the scroller's own top edge, as in the list).
  -->
  {#if phone}
    <!-- The back button, labeled with the list's name, on the left; the way to the publisher on the right. -->
    <div class="reading-bar pane-bar nav-bar relative z-10 gap-2">
      <button type="button" onclick={phone.onBack} aria-label="Back to {phone.back}" title="Back to {phone.back}" class="btn-quiet nav-back min-w-0 shrink"
        ><Icon name="back" size={22} /><span class="truncate">{phone.back}</span></button
      >
      <p role="status" class="line-clamp-2 min-w-0 flex-1 text-center text-small empty:sr-only">{copied}</p>
      {#if article.link}
        <span class="ml-auto">{@render original(22)}</span>
      {/if}
    </div>
  {:else}
    <!--
      Quiet icons, each named in its tooltip with its key, in one cluster at the right, 4px apart: the way to the
      publisher, then the reader's own tools. The left holds only the pane buttons, like Apple Books' reading toolbar (decision 0050).
    -->
    <div class={["reading-bar pane-bar relative z-10 gap-2 pr-2", toggles === 2 ? "pl-[6.5rem]" : toggles === 1 ? "pl-14" : "pl-2"]}>
      {#if !article.link}
        <p class="px-2 text-small text-muted">This article has no link to its original.</p>
      {/if}
      <p role="status" class="line-clamp-2 min-w-0 flex-1 text-center text-small empty:sr-only">{copied}</p>
      <div class="ml-auto flex items-center gap-1">
        {#if article.link}
          {@render original(20)}
        {/if}
        {@render aa(20, "btn-quiet btn-icon")}
        <!-- A toggle keeps one name for screen readers ("Star", pressed or not); the filled star shows its state. -->
        <button type="button" aria-label="Star" aria-pressed={article.starred} title={tip(article.starred ? "Unstar" : "Star", "star")} onclick={onStar} class={["btn-quiet btn-icon", article.starred && "text-ink"]}>
          {@render starIcon(20)}
        </button>
        {#if writable}{@render writeBackButton(20, "btn-quiet btn-icon")}{/if}
        <MoreMenu id="article-menu" label="More actions" groups={more} />
      </div>
    </div>
  {/if}

  <div
    use:edge
    bind:this={scroller}
    onscroll={scrolled}
    class="reading-scroller scroller scroll-gutter relative min-h-0 flex-1 overflow-y-auto bg-paper px-5 pb-8 md:px-14">
    <article lang={full?.language ?? undefined} class="article pt-3">
      <h2 tabindex="-1" bind:this={heading} class="article-title">{article.title || "Untitled"}</h2>
      <!-- Under the title, as in a book or a magazine: who wrote it, where, and when. The publisher's name leads, in full ink. -->
      <p class="article-byline" lang="en">
        {#if followed}
          <!-- Someone followed: their name opens the page about them, as at the top of their list (decision 0214); no "›" here, where the "·" follows. -->
          <button type="button" class="publisher writer-link" title={tip(`Info about ${article.feedTitle}`, "about")} aria-describedby="byline-about" onclick={() => onWriter(library.rowOf(article.feedId))}
            >{article.feedTitle}</button
          ><span id="byline-about" aria-hidden="true" class="sr-only">Opens the page about them.</span>
        {:else if full?.siteUrl}
          <a href={full.siteUrl} target="_blank" rel="noopener noreferrer" class="publisher hover:underline hover:underline-offset-4">{article.feedTitle}<span class="sr-only"> (opens in a new tab)</span></a>
        {:else}
          <span class="publisher">{article.feedTitle}</span>
        {/if}
        {#if author}· {author}{/if}
        · <time datetime={new Date(article.at * 1000).toISOString()}>{when(article.at)}</time>
      </p>

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
            <div bind:this={text} id="article-text" class={["article-text", folded && "folded"]} dir="auto">{@html full.content}</div>
          {/key}
          {#if video && foldable(full.content)}
            <button type="button" class="text-link" aria-expanded={!folded} aria-controls="article-text" lang="en" onclick={() => (unfoldedFor = folded ? article.id : undefined)}
              >{folded ? "Show the full description" : "Show less"}</button
            >
          {/if}
          <!-- The last page: a short rule, so the article ends rather than stops. -->
          <hr aria-hidden="true" class="article-end" />
        {:else if full.summary}
          {#key full.id}
            <div bind:this={text} class="article-text" dir="auto">{@html full.summary}</div>
          {/key}
          <hr aria-hidden="true" class="article-end" />
          <!--
            End matter, under the closing rule as in a book: where the rest of it is. The sentence, then the
            link to the publisher on a row of its own, 44px tall to press: "Read on {publisher} ›", or for a
            podcast's episode "Read the episode page on {publisher} ›" (SPEC sections 7 and 35). The sentence
            and the link each stay whole wherever they fit on a line, so a narrow column never strands a word
            (decision 0044).
          -->
          <p class="article-note" lang="en">
            <span>Only the beginning is shared here.</span>{#if article.link}{" "}<a href={article.link} target="_blank" rel="noopener noreferrer"
                >{episode ? "Read the episode page on" : "Read on"} {site}<span aria-hidden="true">&nbsp;›</span><span class="sr-only"> (opens in a new tab)</span></a
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
        <WriteBack bind:this={writeBack} {article} {library} quotes={() => marks?.quotes() ?? []} />
      {/if}
    </article>
  </div>

  {#if phone && beforeToolbar}
    {@render beforeToolbar()}
  {/if}
  {#if phone}
    <!--
      Within thumb reach: quiet icons, each named for screen readers, above a
      hairline so the text ends at an edge rather than being sliced. Previous
      on the first article (or Next on the last) keeps its arrow and its place,
      faded, as iOS dims a toolbar button, so the bar never shows a hole; it
      says "dimmed" to screen readers and does nothing (decision 0047).
    -->
    <div role="group" aria-label="Article actions" class="toolbar relative z-10 flex shrink-0 bg-paper px-1 pb-[env(safe-area-inset-bottom)]">
      <button type="button" aria-label="Previous" aria-disabled={!phone.hasPrevious} onclick={() => phone.hasPrevious && phone.onPrevious()}>
        <Icon name="chevron-up" size={22} />
      </button>
      <button type="button" aria-label="Next" aria-disabled={!phone.hasNext} onclick={() => phone.hasNext && phone.onNext()}>
        <Icon name="chevron-down" size={22} />
      </button>
      {@render aa(22, "")}
      <button type="button" aria-label="Star" aria-pressed={article.starred} onclick={onStar} class:text-ink={article.starred}>
        {@render starIcon(22)}
      </button>
      {#if writable}{@render writeBackButton(22, "")}{/if}
      <!-- Share (or Copy link) and Mark unread, in a menu that opens upwards. -->
      <MoreMenu id="article-menu" label="More actions" groups={more} size={22} up />
    </div>
  {/if}

  {#if opened}
    <PictureSheet src={opened.src} alt={opened.alt} lang={full?.language ?? undefined} onClose={closePicture} />
  {/if}

  {#if panelOpen}
    <ReadingPanel bind:preferences anchor={aaButton} phone={phone !== undefined} onClose={closePanel} />
  {/if}
</section>

<style>
  /*
    Room for a scrollbar is kept, so the article's centre doesn't shift between
    pages that scroll and those that don't. The track is see-through, so the
    gutter is the page's own color in every theme, and the thumb a faint tone
    of the text (decision 0040).
  */
  .scroll-gutter {
    scrollbar-gutter: stable;
    /* Muted grey: at least 3 : 1 against the page, as a control should be. */
    scrollbar-color: var(--muted) transparent;
  }
  /* A footnote or heading the keyboard moves to stops a little below the top bar. */
  .reading-scroller {
    scroll-padding-top: 1rem;
  }
  /*
    The top bar (decision 0040): solid, in the page's own color, never
    see-through or blurred. Its hairline is the scroller's top edge
    (app.css → .scroller), shown only once the text has scrolled.
  */
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
    least 44px square, in the second ink (a starred star in full ink).
  */
  .toolbar {
    border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
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
  /*
    One that can't act right now (Previous on the first article) stays in
    its place, its arrow faded, so the bar keeps its five even places. A
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
  /* The writer's name under the title: a 44px target to touch, taller than its line without moving it. */
  .writer-link {
    padding-block: 0.75rem;
    margin-block: -0.75rem;
    cursor: pointer;
  }
  @media (hover: hover) {
    .writer-link:hover {
      text-decoration: underline;
      text-underline-offset: 4px;
    }
  }
  /* A long video description, folded: its first paragraph only, until "Show the full description" (decision 0144). */
  .folded > :global(:not(:first-child)) {
    display: none;
  }
</style>
