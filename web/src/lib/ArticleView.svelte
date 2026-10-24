<!--
  The reading area (SPEC section 7): the article exactly as the publisher's
  feed gives it, cleaned by slowfeed and restyled in the reader's font, size
  and line width. "Open original" and Copy link (Share on phones) always sit
  in the same place above it. The source is always credited and linked.
  A feed that gives only a summary shows the summary; slowfeed never fetches
  the rest from the publisher's site. Star and Mark unread sit beside them
  (SPEC sections 8 and 9).

  On a phone (SPEC section 20) the article is a screen of its own: the top
  bar has the back arrow, named after the list, and Mark unread; Previous,
  Next, Star, Share and Open original sit in a toolbar at the bottom, within
  thumb reach.
-->
<script lang="ts">
  import { edge } from "./edge";
  import Icon from "./Icon.svelte";
  import { articleNow, readArticle, when, type Article, type FullArticle } from "./feeds";

  let {
    article,
    heading = $bindable(),
    phone,
    onStar,
    onMarkUnread,
  }: {
    /** The article chosen in the list; its title, source and time show at once. */
    article: Article;
    heading?: HTMLHeadingElement;
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

{#snippet starIcon(size: number)}
  <!-- Filled when starred, an outline when not: the shape says it, not only the color. -->
  <Icon name="star" {size} filled={article.starred} />
{/snippet}

<section aria-label="Article" class="flex min-w-0 flex-1 flex-col bg-paper pt-2">
  <!-- Never scrolls, so these are always in the same place. -->
  {#if phone}
    <div class="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-2">
      <button type="button" onclick={phone.onBack} aria-label="Back to {phone.back}" class="btn-quiet min-w-0 shrink justify-start gap-1 px-2 text-left whitespace-normal"
        ><Icon name="back" size={20} /><span class="min-w-0 break-words">{phone.back}</span></button
      >
      <button type="button" onclick={onMarkUnread} class="btn-quiet -mr-3"><Icon name="dot" />Mark unread</button>
      <p role="status" class="w-full px-2 text-small empty:sr-only">{copied}</p>
    </div>
  {:else}
  <!-- In the same centred column as the article, so the actions sit right above its text. -->
  <!--
    The way to the publisher in words, on the left; the everyday actions as
    icons on the right, each named in its tooltip with its key.
  -->
  <!-- Its own 4px above the buttons, so their focus outlines are never clipped. -->
  <div class="scroll-gutter overflow-y-hidden px-6 pt-1 pb-2 md:px-10"><div class="article-column relative flex min-h-11 flex-wrap items-center justify-between gap-x-1 gap-y-2">
    {#if article.link}
      <a href={article.link} target="_blank" rel="noopener noreferrer" class="btn-quiet btn-small -ml-2.5 font-semibold text-ink" title="Open original (v)"><Icon name="open" size={16} />Open original</a>
    {:else}
      <p class="text-small text-muted">This article has no link to its original.</p>
    {/if}
    <div class="-mr-2.5 flex items-center">
      {#if article.link}
        <button type="button" onclick={share} aria-label={sharing ? "Share" : "Copy link"} title={sharing ? "Share" : "Copy link"} class="btn-quiet btn-icon">
          <Icon name={sharing ? "share" : "link"} size={18} />
        </button>
      {/if}
      <!-- A toggle keeps one name for screen readers ("Star", pressed or not); the filled star shows its state. -->
      <button type="button" aria-label="Star" aria-pressed={article.starred} title={article.starred ? "Starred (s)" : "Star (s)"} onclick={onStar} class={["btn-quiet btn-icon", article.starred && "text-ink"]}>
        {@render starIcon(18)}
      </button>
      <button type="button" onclick={onMarkUnread} aria-label="Mark unread" title="Mark unread (m)" class="btn-quiet btn-icon"><Icon name="dot" size={18} /></button>
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
    <!-- Within thumb reach. Each button has its word under its icon; one that can't act says so. -->
    <div role="group" aria-label="Article actions" class="toolbar flex shrink-0 bg-list px-1 pb-[env(safe-area-inset-bottom)]">
      <button type="button" aria-disabled={!phone.hasPrevious} onclick={() => phone.hasPrevious && phone.onPrevious()} class:text-muted={!phone.hasPrevious}>
        <svg aria-hidden="true" class:invisible={!phone.hasPrevious} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12.5 4 6.5 10l6 6" /></svg>
        Previous
      </button>
      <button type="button" aria-disabled={!phone.hasNext} onclick={() => phone.hasNext && phone.onNext()} class:text-muted={!phone.hasNext}>
        <svg aria-hidden="true" class:invisible={!phone.hasNext} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m7.5 4 6 6-6 6" /></svg>
        Next
      </button>
      <button type="button" aria-pressed={article.starred} onclick={onStar}>
        {@render starIcon(20)}
        Star
      </button>
      {#if article.link}
        <button type="button" onclick={share}>
          <Icon name={sharing ? "share" : "link"} size={20} />
          {sharing ? "Share" : "Copy link"}
        </button>
        <!-- "Original" fits on one line beside the others; its full name is still "Open original". -->
        <a href={article.link} target="_blank" rel="noopener noreferrer" aria-label="Open original">
          <Icon name="open" size={20} />
          Original
        </a>
      {:else}
        <!-- No link to share or open: the places stay, so nothing moves between articles. -->
        <button type="button" aria-disabled="true" class="text-muted"><span class="h-5" aria-hidden="true"></span>Share</button>
        <button type="button" aria-disabled="true" aria-label="Open original" class="text-muted"><span class="h-5" aria-hidden="true"></span>Original</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  /* The toolbar and the article both keep room for a scrollbar, so their centres match. */
  .scroll-gutter {
    scrollbar-gutter: stable;
  }
  /*
    The phone's bottom toolbar: five equal places, each at least 44px tall. A
    place that can't act loses its icon, so it shows without color too. Icons
    and words start from the top, so the icons stay in one line even if a
    word takes two lines on a very narrow phone.
  */
  .toolbar > :global(*) {
    display: flex;
    flex: 1 1 0;
    min-width: 0;
    min-height: 3.5rem;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.125rem;
    padding: 0.5rem 0.25rem 0.375rem;
    font-size: var(--text-small);
    line-height: 1.2;
    text-align: center;
  }
</style>
