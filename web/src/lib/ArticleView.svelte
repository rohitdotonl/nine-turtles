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

<section aria-label="Article" class={["flex min-w-0 flex-1 flex-col bg-paper", phone ? "pt-2" : "pt-16"]}>
  <!-- Never scrolls, so these are always in the same place. -->
  {#if phone}
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-2">
      <button type="button" onclick={phone.onBack} class="min-h-11 min-w-0 rounded px-2 text-left break-words">‹ {phone.back}</button>
      <button type="button" onclick={onMarkUnread} class="btn-quiet -mr-3"><Icon name="unread" />Mark unread</button>
      <p role="status" class="w-full px-2 text-small empty:hidden">{copied}</p>
    </div>
  {:else}
  <div class="-ml-3 flex flex-wrap items-center gap-x-1 gap-y-2 px-6 pb-4 md:px-10">
    {#if article.link}
      <a href={article.link} target="_blank" rel="noopener noreferrer" class="btn-quiet"><Icon name="open" />Open original</a>
      <button type="button" onclick={share} class="btn-quiet">
        <Icon name={sharing ? "share" : "link"} />{sharing ? "Share" : "Copy link"}
      </button>
    {:else}
      <p class="px-3 text-small text-muted">This article has no link to its original.</p>
    {/if}
    <button type="button" aria-pressed={article.starred} onclick={onStar} class="btn-quiet">
      {@render starIcon(18)}
      Star
    </button>
    <button type="button" onclick={onMarkUnread} class="btn-quiet"><Icon name="unread" />Mark unread</button>
    <p role="status" class="px-3 text-small">{copied}</p>
  </div>
  {/if}

  <div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto px-6 pb-16 md:px-10">
    <article lang={full?.language ?? undefined} class="article">
      <p class="text-small text-muted" lang="en">
        {#if full?.siteUrl}
          <a href={full.siteUrl} target="_blank" rel="noopener noreferrer" class="underline underline-offset-4"
            >{article.feedTitle}</a
          >
        {:else}
          {article.feedTitle}
        {/if}
        {#if full?.author}· {full.author}{/if}
        · <time datetime={new Date(article.at * 1000).toISOString()}>{when(article.at)}</time>
      </p>
      <h2 tabindex="-1" bind:this={heading} class="article-title">{article.title || "Untitled"}</h2>

      {#if full}
        {#if full.content}
          <!-- Cleaned by slowfeed before it was stored (server/src/feed.rs). -->
          <div class="article-text" dir="auto">{@html full.content}</div>
        {:else if full.summary}
          <div class="article-text" dir="auto">{@html full.summary}</div>
          <p class="mt-8 text-small" lang="en">
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
    <div role="group" aria-label="Article actions" class="toolbar flex shrink-0 bg-list px-1">
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
        <a href={article.link} target="_blank" rel="noopener noreferrer">
          <Icon name="open" size={20} />
          Open original
        </a>
      {:else}
        <!-- No link to share or open: the places stay, so nothing moves between articles. -->
        <button type="button" aria-disabled="true" class="text-muted"><span class="h-5" aria-hidden="true"></span>Share</button>
        <button type="button" aria-disabled="true" class="text-muted"><span class="h-5" aria-hidden="true"></span>Open original</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  /* The phone's bottom toolbar: five equal places, each at least 44px tall. A place that can't act loses its icon, so it shows without color too. */
  .toolbar > :global(*) {
    display: flex;
    flex: 1 1 0;
    min-width: 0;
    min-height: 3.5rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    padding: 0.25rem;
    font-size: var(--text-small);
    line-height: 1.2;
    text-align: center;
  }
</style>
