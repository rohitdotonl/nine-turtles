<!--
  The reading area (SPEC section 7): the article exactly as the publisher's
  feed gives it, cleaned by slowfeed and restyled in the reader's font, size
  and line width. A quiet bar of icons sits at the top of the pane, anchored
  to its edges (decision 0038), each named in its tooltip (with its key) and
  to screen readers: Open original at the left, always in the same place;
  Aa (the reading panel), Star and More (…) at the right. More holds Copy
  link (Share on phones) and Mark unread (SPEC sections 7, 8, 9 and 21). The
  bar is the page's color, slightly see-through and blurred, so the text
  fades under it as it scrolls (solid when the system asks for less
  transparency). The source is always credited and linked. A feed that gives
  only a summary shows the summary, ending with a line that links the whole
  article on the publisher's site; slowfeed never fetches the rest.

  On a phone (SPEC section 20) the article is a screen of its own: the top
  bar has the back button, labeled with the list's name, and Open original;
  Previous, Next, Aa, Star and More sit as icons in a toolbar at the bottom,
  within thumb reach.
-->
<script lang="ts">
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import MoreMenu, { type MenuGroup } from "./MoreMenu.svelte";
  import ReadingPanel from "./ReadingPanel.svelte";
  import type { Preferences } from "./preferences";
  import { articleNow, readArticle, when, type Article, type FullArticle } from "./feeds";

  let {
    article,
    heading = $bindable(),
    preferences = $bindable(),
    phone,
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
    onStar: () => void;
    onMarkUnread: () => void;
  } = $props();

  // Bumped when an article arrives from the server, so the page looks again.
  let arrivals = $state(0);
  let problem = $state(false);
  let copied = $state("");
  let scroller: HTMLDivElement | undefined = $state();
  /** The Aa reading panel, and its button (there's one, on the top bar or the phone's bottom bar). */
  let panelOpen = $state(false);
  let aaButton: HTMLButtonElement | undefined = $state();

  function closePanel(giveBack: boolean) {
    panelOpen = false;
    if (giveBack) aaButton?.focus();
  }

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
        ...(article.link ? [{ label: sharing ? "Share" : "Copy link", onSelect: share }] : []),
        { label: "Mark unread", shortcut: phone ? undefined : "m", onSelect: onMarkUnread },
      ],
    },
  ]);

  $effect(() => {
    const id = article.id;
    problem = false;
    copied = "";
    // A new article starts at its top.
    if (scroller) scroller.scrollTop = 0;
    if (articleNow(id)) return;
    readArticle(id).then(
      () => arrivals++,
      () => {
        if (article.id === id) problem = true;
      },
    );
  });

  // Footnotes: a link to a place inside the article (cleaned to `#article-…`
  // by slowfeed) scrolls there and moves the keyboard's place with it,
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
    try {
      await navigator.clipboard.writeText(link);
      copied = "Link copied.";
    } catch {
      copied = "The link couldn't be copied. Use Open original and copy it from there.";
    }
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
  <a href={article.link} target="_blank" rel="noopener noreferrer" aria-label="Open original" title={phone ? "Open original" : "Open original (v)"} class="btn-quiet btn-icon"
    ><Icon name="open" {size} /></a
  >
{/snippet}

<section aria-label="Article" class="flex min-w-0 flex-1 flex-col bg-paper">
  <!--
    The article scrolls under its top bar: the bar sits at the top of the
    scrolling area (sticky), across the whole pane, so its icons are anchored
    to the pane's edges rather than the text column, and the text fades
    under it. A faint line shows under the bar once the text has scrolled.
  -->
  <div use:edge bind:this={scroller} class="reading-scroller scroll-gutter relative min-h-0 flex-1 overflow-y-auto px-6 pb-[30vh] md:px-10">
    {#if phone}
      <!-- The back button, labeled with the list's name, on the left; the way to the publisher on the right. -->
      <div class="reading-bar sticky top-0 z-10 -mx-6 flex min-h-13 items-center gap-2 px-1 py-1 md:-mx-10">
        <button type="button" onclick={phone.onBack} aria-label="Back to {phone.back}" title="Back to {phone.back}" class="btn-quiet min-w-0 shrink gap-0.5 pr-2 pl-1"
          ><Icon name="back" size={22} /><span class="truncate">{phone.back}</span></button
        >
        <p role="status" class="line-clamp-2 min-w-0 flex-1 text-center text-small empty:sr-only">{copied}</p>
        {#if article.link}
          <span class="ml-auto">{@render original(22)}</span>
        {/if}
      </div>
    {:else}
      <!-- Quiet icons, each named in its tooltip with its key: the way to the publisher at the left, the reader's own tools at the right. -->
      <div class="reading-bar sticky top-0 z-10 -mx-6 flex min-h-13 items-center gap-2 px-2 py-1 md:-mx-10">
        {#if article.link}
          {@render original(20)}
        {:else}
          <p class="px-2 text-small text-muted">This article has no link to its original.</p>
        {/if}
        <p role="status" class="line-clamp-2 min-w-0 flex-1 text-center text-small empty:sr-only">{copied}</p>
        <div class="ml-auto flex items-center">
          {@render aa(20, "btn-quiet btn-icon")}
          <!-- A toggle keeps one name for screen readers ("Star", pressed or not); the filled star shows its state. -->
          <button type="button" aria-label="Star" aria-pressed={article.starred} title={article.starred ? "Starred (s)" : "Star (s)"} onclick={onStar} class={["btn-quiet btn-icon", article.starred && "text-ink"]}>
            {@render starIcon(20)}
          </button>
          <MoreMenu id="article-menu" label="More actions" groups={more} />
        </div>
      </div>
    {/if}

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

      {#if full}
        {#if full.content}
          <!-- Cleaned by slowfeed before it was stored (server/src/feed.rs). -->
          <div class="article-text" dir="auto">{@html full.content}</div>
          <!-- The last page: a short rule, so the article ends rather than stops. -->
          <hr aria-hidden="true" class="article-end" />
        {:else if full.summary}
          <div class="article-text" dir="auto">{@html full.summary}</div>
          <!-- The article's own last paragraph, in the book's voice: where the rest of it is, crediting the publisher. -->
          <p class="article-note" lang="en">
            This feed shares only a summary.{#if article.link}
              <a href={article.link} target="_blank" rel="noopener noreferrer">Read the full article on {article.feedTitle}<span aria-hidden="true">&nbsp;›</span></a
              >{/if}
          </p>
          <hr aria-hidden="true" class="article-end" />
        {:else}
          <p class="mt-6" lang="en">This article has no text in its feed. Open original to read it on the publisher's site.</p>
        {/if}
      {:else if problem}
        <p class="mt-6" lang="en">This article couldn't be loaded. Try again in a moment.</p>
      {/if}
    </article>
  </div>

  {#if phone}
    <!--
      Within thumb reach: quiet icons, each named for screen readers. One that
      can't act loses its icon, so it shows without color, and keeps its place.
    -->
    <div role="group" aria-label="Article actions" class="toolbar relative z-10 flex shrink-0 bg-paper px-1 pb-[env(safe-area-inset-bottom)]">
      <button type="button" aria-label="Previous" aria-disabled={!phone.hasPrevious} onclick={() => phone.hasPrevious && phone.onPrevious()}>
        <svg aria-hidden="true" class:invisible={!phone.hasPrevious} width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 4 6.5 10l6 6" /></svg>
      </button>
      <button type="button" aria-label="Next" aria-disabled={!phone.hasNext} onclick={() => phone.hasNext && phone.onNext()}>
        <svg aria-hidden="true" class:invisible={!phone.hasNext} width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4 6 6-6 6" /></svg>
      </button>
      {@render aa(22, "")}
      <button type="button" aria-label="Star" aria-pressed={article.starred} onclick={onStar} class:text-ink={article.starred}>
        {@render starIcon(22)}
      </button>
      <!-- Share (or Copy link) and Mark unread, in a menu that opens upwards. -->
      <MoreMenu id="article-menu" label="More actions" groups={more} size={22} up />
    </div>
  {/if}

  {#if panelOpen}
    <ReadingPanel bind:preferences anchor={aaButton} phone={phone !== undefined} onClose={closePanel} />
  {/if}
</section>

<style>
  /* Room for a scrollbar is kept, so the article's centre doesn't shift between pages that scroll and those that don't. */
  .scroll-gutter {
    scrollbar-gutter: stable;
  }
  /* A footnote or heading the keyboard moves to stops below the top bar, not under it. */
  .reading-scroller {
    scroll-padding-top: 3.75rem;
  }
  /*
    The top bar (DESIGN.md → Exceptions log, decision 0038): the page's own
    color at 85%, blurred, so the text fades under it rather than being cut
    off; a faint line under it only once the text has scrolled. Solid where
    the system asks for less transparency, and in high-contrast modes.
  */
  .reading-bar {
    border-bottom: 1px solid transparent;
    background-color: color-mix(in srgb, var(--paper) 85%, transparent);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
    backdrop-filter: blur(12px) saturate(1.2);
  }
  .reading-scroller:global([data-scrolled]) > .reading-bar {
    border-bottom-color: color-mix(in srgb, var(--ink) 12%, transparent);
  }
  @media (prefers-reduced-transparency: reduce) {
    .reading-bar {
      background-color: var(--paper);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }
  @media (forced-colors: active) {
    .reading-bar {
      background-color: Canvas;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }
  /*
    The phone's bottom toolbar: five equal places of quiet icons, each at
    least 44px square, in the second ink (a starred star in full ink).
  */
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
</style>
