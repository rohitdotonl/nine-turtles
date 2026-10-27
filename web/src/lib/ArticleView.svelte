<!--
  The reading area (SPEC section 7): the article exactly as the publisher's
  feed gives it, cleaned by nine turtles and restyled in the reader's font, size
  and line width. A quiet bar of icons sits at the top of the pane, anchored
  to its edges (decision 0038), each named in its tooltip (with its key) and
  to screen readers, together at the right as Apple Books keeps its reading
  toolbar (decision 0050): Open original, Aa (the reading panel), Star and
  More (…). More holds Copy
  link (Share on phones) and Mark unread (SPEC sections 7, 8, 9 and 21). The
  bar is solid, in the page's own color, above the scrolling text, with a
  hairline under it only once the text has scrolled (decision 0040). The
  source is always credited and linked. A feed that gives only a summary
  shows the summary, then a small centred note under the closing rule that
  links the whole article on the publisher's site; nine turtles never fetches
  the rest. A YouTube video plays above its text in YouTube's own player,
  loaded only once you press Play (decision 0072). A picture shown clearly
  smaller than it really is opens larger on a sheet of its own (decision 0107).

  On a phone (SPEC section 20) the article is a screen of its own: the top
  bar has the back button, labeled with the list's name, and Open original;
  Previous, Next, Aa, Star and More sit as icons in a toolbar at the bottom,
  within thumb reach, above a hairline; one that can't act is faded in place.
-->
<script lang="ts">
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import MoreMenu, { type MenuGroup } from "./MoreMenu.svelte";
  import ReadingPanel from "./ReadingPanel.svelte";
  import YouTubePlayer from "./YouTubePlayer.svelte";
  import { youtubeVideo } from "./youtube";
  import type { Preferences } from "./preferences";
  import { articleNow, readArticle, when, type Article, type FullArticle } from "./feeds";
  import { goTo, keepPlace, placeIn, placeOf, type Place } from "./places";
  import { connection } from "./connection.svelte";
  import { NOT_KEPT } from "./offline";
  import PictureSheet from "./PictureSheet.svelte";
  import { OPENABLE, markPicture } from "./pictures";
  import { keyFor } from "./keyboard";

  let {
    article,
    heading = $bindable(),
    preferences = $bindable(),
    phone,
    toggles = 0,
    onStar,
    onMarkUnread,
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
  } = $props();

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

  /** Phones get the system's share sheet; computers get Copy link (SPEC section 21). */
  const sharing =
    typeof navigator.share === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;

  /** The article's less frequent actions, behind More (…): sharing its link, and marking it unread. */
  let more: MenuGroup[] = $derived([
    {
      items: [
        ...(article.link ? [{ label: sharing ? "Share" : "Copy link", shortcut: phone || sharing ? undefined : keyFor("copy-link"), onSelect: share }] : []),
        { label: "Mark unread", shortcut: phone ? undefined : keyFor("mark-unread"), onSelect: onMarkUnread },
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
    if (latest) keepPlace(latest.id, latest.place);
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
    moved = false;
    problem = false;
    copied = "";
    // A new article starts at its top, unless you stopped part of the way through it (below).
    if (scroller) scroller.scrollTop = 0;
    if (articleNow(id)) return;
    readArticle(id).then(
      () => arrivals++,
      () => {
        if (article.id === id) problem = true;
      },
    );
  });

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

  // Pictures that open larger (decision 0107): one the page shows clearly
  // smaller than it really is, once it has loaded, and not inside a link,
  // becomes a button. Looked at again whenever a picture loads or changes
  // size (the window, the text size or the line width changing).
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
      copied = "The link couldn't be copied. Use Open original and copy it from there.";
    }
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
  <!-- The reading panel's button: text size, theme, font and line width, one press from the text. -->
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

{#snippet original(size: number)}
  <a href={article.link} target="_blank" rel="noopener noreferrer" aria-label="Open original" title={phone ? "Open original" : "Open original (V)"} class="btn-quiet btn-icon"
    ><Icon name="open" {size} /></a
  >
{/snippet}

<!-- A key that scrolls: the reader is moving through the article themselves. -->
<svelte:window onkeydown={(event) => SCROLL_KEYS.has(event.key) && (moved = true)} />

<section aria-label="Article" class="flex min-w-0 flex-1 flex-col bg-paper">
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
        <button type="button" aria-label="Star" aria-pressed={article.starred} title={article.starred ? "Starred (S)" : "Star (S)"} onclick={onStar} class={["btn-quiet btn-icon", article.starred && "text-star"]}>
          {@render starIcon(20)}
        </button>
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
        {#if full?.siteUrl}
          <a href={full.siteUrl} target="_blank" rel="noopener noreferrer" class="publisher hover:underline hover:underline-offset-4">{article.feedTitle}</a>
        {:else}
          <span class="publisher">{article.feedTitle}</span>
        {/if}
        {#if full?.author}· {full.author}{/if}
        · <time datetime={new Date(article.at * 1000).toISOString()}>{when(article.at)}</time>
      </p>

      {#if video && connection.offline}
        <!-- Without a connection there's no player to load: the video waits, as images do (SPEC section 32). -->
        <p class="article-note mt-6" lang="en">The video plays here when you're back online.</p>
      {:else if video}
        {#key article.id}
          <YouTubePlayer {video} title={article.title || "Untitled"} />
        {/key}
      {/if}
      {#if full}
        {#if full.content}
          <!-- Cleaned by nine turtles before it was stored (server/src/feed.rs). -->
          <div bind:this={text} class="article-text" dir="auto">{@html full.content}</div>
          <!-- The last page: a short rule, so the article ends rather than stops. -->
          <hr aria-hidden="true" class="article-end" />
        {:else if full.summary}
          <div bind:this={text} class="article-text" dir="auto">{@html full.summary}</div>
          <hr aria-hidden="true" class="article-end" />
          <!--
            End matter, under the closing rule as in a book: where the rest of it is. The publisher is already
            named in the byline, so the link says only "Read the full article ›"; screen readers hear whose site
            it opens. Each sentence stays whole wherever it fits on a line, so a narrow column never strands a word (decision 0044).
          -->
          <p class="article-note" lang="en">
            <span>This feed shares only a summary.</span>{#if article.link}{" "}<a href={article.link} target="_blank" rel="noopener noreferrer">Read the full article<span class="sr-only"> on {article.feedTitle}</span><span aria-hidden="true">&nbsp;›</span></a
              >{/if}
          </p>
        {:else if video}
          <hr aria-hidden="true" class="article-end" />
        {:else}
          <p class="mt-6" lang="en">This article has no text in its feed. Open original to read it on the publisher's site.</p>
        {/if}
      {:else if problem}
        <p class="mt-6" lang="en">{connection.offline ? NOT_KEPT : "This article couldn't be loaded. Try again in a moment."}</p>
      {/if}
    </article>
  </div>

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
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4 6.5 10l6 6" /></svg>
      </button>
      <button type="button" aria-label="Next" aria-disabled={!phone.hasNext} onclick={() => phone.hasNext && phone.onNext()}>
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4 6 6-6 6" /></svg>
      </button>
      {@render aa(22, "")}
      <button type="button" aria-label="Star" aria-pressed={article.starred} onclick={onStar} class:text-star={article.starred}>
        {@render starIcon(22)}
      </button>
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
    The phone's bottom toolbar: five equal places of quiet icons, each at
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
  .toolbar > [aria-disabled="true"] > svg {
    opacity: 0.35;
  }
</style>
