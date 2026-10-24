<!--
  The reading area (SPEC section 7): the article exactly as the publisher's
  feed gives it, cleaned by slowfeed and restyled in the reader's font, size
  and line width. A quiet row of icons sits above it, each named in its
  tooltip (with its key) and to screen readers: Open original on the left,
  always in the same place; then Aa (the reading panel), Copy link (Share on
  phones), Star and Mark unread on the right (SPEC sections 7, 8 and 9).
  The source is always credited and linked. A feed that gives only a summary
  shows the summary; slowfeed never fetches the rest from the publisher's site.

  On a phone (SPEC section 20) the article is a screen of its own: the top
  bar has the back arrow, named after the list, and Open original; Previous,
  Next, Aa, Star, Mark unread and Share sit as icons in a toolbar at the
  bottom, within thumb reach.
-->
<script lang="ts">
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
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
  /** The Aa reading panel, and its button (there's one, on the top line or the phone's bottom bar). */
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

<section aria-label="Article" class="flex min-w-0 flex-1 flex-col bg-paper pt-2">
  <!-- Never scrolls, so these are always in the same place. -->
  {#if phone}
    <!-- Quiet icons: back to the list on the left, the way to the publisher on the right. -->
    <div class="relative flex flex-wrap items-center justify-between gap-x-4 px-3 pb-1">
      <button type="button" onclick={phone.onBack} aria-label="Back to {phone.back}" title="Back to {phone.back}" class="btn-quiet btn-icon"
        ><Icon name="back" size={22} /></button
      >
      {#if article.link}
        <a href={article.link} target="_blank" rel="noopener noreferrer" aria-label="Open original" title="Open original" class="btn-quiet btn-icon"
          ><Icon name="open" size={22} /></a
        >
      {/if}
      <p role="status" class="w-full px-2 pb-1 text-small empty:sr-only">{copied}</p>
    </div>
  {:else}
  <!-- In the same centred column as the article, so the actions sit right above its text. -->
  <!--
    Quiet icons, each named in its tooltip with its key: the way to the
    publisher on the left, always in the same place; the reader's own tools
    on the right.
  -->
  <!-- Its own 4px above the buttons, so their focus outlines are never clipped. -->
  <div class="scroll-gutter overflow-y-hidden px-6 pt-1 pb-2 md:px-10"><div class="article-column relative flex min-h-11 flex-wrap items-center gap-x-1 gap-y-2">
    {#if article.link}
      <a href={article.link} target="_blank" rel="noopener noreferrer" aria-label="Open original" title="Open original (v)" class="btn-quiet btn-icon -ml-3"><Icon name="open" size={20} /></a>
    {:else}
      <p class="text-small text-muted">This article has no link to its original.</p>
    {/if}
    <div class="-mr-3 ml-auto flex items-center">
      {@render aa(20, "btn-quiet btn-icon")}
      {#if article.link}
        <button type="button" onclick={share} aria-label={sharing ? "Share" : "Copy link"} title={sharing ? "Share" : "Copy link"} class="btn-quiet btn-icon">
          <Icon name={sharing ? "share" : "link"} size={20} />
        </button>
      {/if}
      <!-- A toggle keeps one name for screen readers ("Star", pressed or not); the filled star shows its state. -->
      <button type="button" aria-label="Star" aria-pressed={article.starred} title={article.starred ? "Starred (s)" : "Star (s)"} onclick={onStar} class={["btn-quiet btn-icon", article.starred && "text-ink"]}>
        {@render starIcon(20)}
      </button>
      <button type="button" onclick={onMarkUnread} aria-label="Mark unread" title="Mark unread (m)" class="btn-quiet btn-icon"><Icon name="dot" size={20} /></button>
    </div>
    <p role="status" class="w-full text-small empty:sr-only">{copied}</p>
  </div></div>
  {/if}

  <div use:edge bind:this={scroller} class="scroller scroll-gutter relative min-h-0 flex-1 overflow-y-auto px-6 pb-[30vh] md:px-10">
    <article lang={full?.language ?? undefined} class="article">
      <h2 tabindex="-1" bind:this={heading} class="article-title">{article.title || "Untitled"}</h2>
      <!-- Under the title, as in a book or a magazine: who wrote it, where, and when. -->
      <p class="article-byline text-ink-2" lang="en">
        {#if full?.siteUrl}
          <a href={full.siteUrl} target="_blank" rel="noopener noreferrer" class="font-medium text-ink hover:underline hover:underline-offset-4"
            >{article.feedTitle}</a
          >
        {:else}
          {article.feedTitle}
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
          <hr aria-hidden="true" class="article-end" />
          <p class="mt-6 text-center font-sans text-small text-ink-2" lang="en">
            This feed shares only a summary. The whole article is on the publisher's site{#if article.link}:
              <a href={article.link} target="_blank" rel="noopener noreferrer" class="underline underline-offset-4"
                >Open original</a
              >{/if}.
          </p>
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
    <div role="group" aria-label="Article actions" class="toolbar flex shrink-0 bg-list px-1 pb-[env(safe-area-inset-bottom)]">
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
      <button type="button" aria-label="Mark unread" onclick={onMarkUnread}><Icon name="dot" size={22} /></button>
      {#if article.link}
        <button type="button" aria-label={sharing ? "Share" : "Copy link"} onclick={share}>
          <Icon name={sharing ? "share" : "link"} size={22} />
        </button>
      {:else}
        <!-- No link to share: the place stays, so nothing moves between articles. -->
        <button type="button" aria-label={sharing ? "Share" : "Copy link"} aria-disabled="true"><span class="size-[22px]" aria-hidden="true"></span></button>
      {/if}
    </div>
  {/if}

  {#if panelOpen}
    <ReadingPanel bind:preferences anchor={aaButton} phone={phone !== undefined} onClose={closePanel} />
  {/if}
</section>

<style>
  /* The toolbar and the article both keep room for a scrollbar, so their centres match. */
  .scroll-gutter {
    scrollbar-gutter: stable;
  }
  /*
    The phone's bottom toolbar: six equal places of quiet icons, each at
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
