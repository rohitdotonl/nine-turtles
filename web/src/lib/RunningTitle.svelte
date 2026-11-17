<!--
  The article's name in a computer's top bar (SPEC section 7, decisions 0298,
  0299 and 0302): once the title has scrolled up under the bar, its copy
  rises from the bar's bottom edge into its middle, the text's true middle,
  step for step with the scroll, so it reads as the title itself passing
  under the bar and coming out on it. Nothing moves by itself: it moves only as the reader scrolls, and with
  reduced motion it's simply there once the title has gone. One line in the
  title's own face, in the muted grey, cut short with …, as the writer wrote
  it. A copy of what's on the page, so screen readers don't hear it twice.
-->
<script lang="ts">
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
    /** Whether the title has gone wholly under the bar. */
    gone?: boolean;
  } = $props();

  /** How far below its place in the bar the copy still is, in pixels; `travel` or more is out of sight. */
  let below = $state(Infinity);
  let travel = $state(0);

  $effect(() => {
    const heading = title;
    const scroller = area;
    below = Infinity;
    gone = false;
    if (!heading || !scroller) return;
    const bar = scroller.querySelector<HTMLElement>(".reading-bar");
    if (!bar) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const place = () => {
      frame = 0;
      const barBox = bar.getBoundingClientRect();
      // From the bar's bottom edge to its middle: the copy's whole way up.
      travel = barBox.height / 2 + 12;
      // How far the title's foot still is below the bar's edge: once it has gone under, the copy rises as far as it scrolls on.
      const left = heading.getBoundingClientRect().bottom - barBox.bottom;
      gone = left <= 0;
      below = still.matches ? (gone ? 0 : Infinity) : Math.max(0, left + travel);
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    scroller.addEventListener("scroll", soon, { passive: true });
    const sizes = new ResizeObserver(soon);
    sizes.observe(scroller);
    sizes.observe(heading);
    return () => {
      scroller.removeEventListener("scroll", soon);
      sizes.disconnect();
      cancelAnimationFrame(frame);
    };
  });
</script>

{#if below < travel}
  <p class="running-title" aria-hidden="true">
    <span class="running-words" style:transform={below > 0 ? `translateY(${below}px)` : undefined}>{words}</span>
  </p>
{/if}

<style>
  /* The bar's whole height, clipped at its edges, so the copy comes into view at the bar's bottom edge. */
  .running-title {
    display: flex;
    min-width: 0;
    height: 100%;
    align-items: center;
    justify-content: center;
    margin: 0;
    overflow: clip;
  }
  /* One line in the title's own face, in the muted grey, cut short with … (decision 0302). */
  .running-words {
    max-width: 100%;
    overflow: hidden;
    font-family: var(--reading-title-font, var(--reading-font));
    font-size: 1.0625rem;
    font-weight: 400;
    letter-spacing: -0.01em;
    line-height: 1.4;
    color: var(--muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
