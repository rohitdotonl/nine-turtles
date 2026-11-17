<!--
  The article's name in a computer's top bar (SPEC section 7, decision 0298):
  once the title has scrolled up under the bar, the bar's middle names it,
  the title in the title's face and the source under it, small and muted,
  each one line cut short with …. It fades in over 0.15 seconds (fadeIn.ts;
  at once with reduced motion) and goes at once when the title is back. A
  copy of what's on the page, so screen readers don't hear it twice.
-->
<script lang="ts">
  import { fadeIn } from "./fadeIn";

  let {
    title,
    area,
    words,
    source,
    gone = $bindable(false),
  }: {
    /** The article's title on the page. */
    title?: HTMLElement;
    /** What scrolls the article, the bar standing at its top. */
    area?: HTMLElement;
    words: string;
    source: string;
    gone?: boolean;
  } = $props();

  $effect(() => {
    const heading = title;
    const scroller = area;
    gone = false;
    if (!heading || !scroller) return;
    const bar = scroller.querySelector<HTMLElement>(".reading-bar");
    // Gone only once it's above the bar, not when it's below the window (a long scroll back up).
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry) gone = !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0) + 1;
      },
      { root: scroller, rootMargin: `-${bar?.offsetHeight ?? 0}px 0px 0px 0px` },
    );
    watch.observe(heading);
    return () => watch.disconnect();
  });
</script>

{#if gone}
  <p class="running-title" aria-hidden="true">
    <span class="running-words" use:fadeIn><span>{words}</span><small>{source}</small></span>
  </p>
{/if}

<style>
  .running-title {
    display: flex;
    min-width: 0;
    flex: 1 1 0;
    flex-direction: column;
    align-items: center;
    line-height: 1.25;
    text-align: center;
  }
  .running-words {
    display: flex;
    max-width: 100%;
    flex-direction: column;
    align-items: center;
  }
  .running-words > * {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .running-words > span {
    font-family: var(--reading-title-font, var(--font-display));
    font-size: var(--text-ui);
    color: var(--ink);
  }
  .running-words > small {
    font-size: var(--text-date);
    color: var(--muted);
  }
</style>
