<!--
  The article's name in a computer's top bar (SPEC section 7, decisions 0298
  and 0299): once the title has scrolled up under the bar, the bar's middle,
  the text's true middle, names it, one line in the muted grey cut short with
  …, as the writer wrote it. It fades in over 0.15 seconds (fadeIn.ts;
  at once with reduced motion) and goes at once when the title is back. A
  copy of what's on the page, so screen readers don't hear it twice.
-->
<script lang="ts">
  import { fadeIn } from "./fadeIn";

  let {
    title,
    area,
    words,
    gone = $bindable(false),
  }: {
    /** The article's title on the page. */
    title?: HTMLElement;
    /** What scrolls the article, the bar standing at its top. */
    area?: HTMLElement;
    words: string;
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
    <span class="running-words" use:fadeIn>{words}</span>
  </p>
{/if}

<style>
  .running-title {
    display: flex;
    min-width: 0;
    justify-content: center;
    margin: 0;
  }
  /* One line in the interface's face, in the muted grey, cut short with … (decision 0299). */
  .running-words {
    max-width: 100%;
    overflow: hidden;
    font-family: var(--font-sans);
    font-size: var(--text-ui);
    line-height: var(--text-ui--line-height);
    color: var(--muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
