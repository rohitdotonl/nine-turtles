<!--
  The reading area (SPEC section 7): the article exactly as the publisher's
  feed gives it, cleaned by slowfeed and restyled in the reader's font, size
  and line width. "Open original" and Copy link (Share on phones) always sit
  in the same place above it. The source is always credited and linked.
  A feed that gives only a summary shows the summary; slowfeed never fetches
  the rest from the publisher's site. Star and Mark unread sit beside them
  (SPEC sections 8 and 9).
-->
<script lang="ts">
  import { articleNow, readArticle, when, type Article, type FullArticle } from "./feeds";

  let {
    article,
    heading = $bindable(),
    back,
    onStar,
    onMarkUnread,
  }: {
    /** The article chosen in the list; its title, source and time show at once. */
    article: Article;
    heading?: HTMLHeadingElement;
    /** On a phone-narrow window: the list to go back to, and how. */
    back?: { name: string; go: () => void };
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

<section aria-label="Article" class="flex min-w-0 flex-1 flex-col bg-paper pt-16">
  <!-- Never scrolls, so these are always in the same place. -->
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pb-4 md:px-10">
    {#if back}
      <button type="button" onclick={back.go} class="min-h-11 rounded px-2">‹ {back.name}</button>
    {/if}
    {#if article.link}
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        class="flex min-h-11 items-center rounded border border-ink px-4">Open original</a
      >
      <button type="button" onclick={share} class="min-h-11 rounded border border-ink px-4">
        {sharing ? "Share" : "Copy link"}
      </button>
    {:else}
      <p class="text-small text-muted">This article has no link to its original.</p>
    {/if}
    <button type="button" aria-pressed={article.starred} onclick={onStar} class="flex min-h-11 items-center gap-2 rounded border border-ink px-4">
      <!-- Filled when starred, an outline when not: the shape says it, not only the color. -->
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 12 12">
        <path
          d="M6 0.8l1.55 3.3 3.6.42-2.66 2.47.7 3.56L6 8.8 2.81 10.55l.7-3.56L.85 4.52l3.6-.42z"
          fill={article.starred ? "currentColor" : "none"}
          stroke="currentColor"
          stroke-width="1"
          stroke-linejoin="round"
        />
      </svg>
      Star
    </button>
    <button type="button" onclick={onMarkUnread} class="min-h-11 rounded border border-ink px-4">Mark unread</button>
    <p role="status" class="text-small">{copied}</p>
  </div>

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
</section>
