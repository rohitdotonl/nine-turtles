<!--
  An article's own pulls on a phone (SPEC section 20, decisions 0274, 0276
  and 0279), as the toolbar's Previous and Next: pulled on up past its end,
  the next article; pulled on down past its top, the previous one. Sideways
  is only for going back (`SwipeBack.svelte`), so each way means one thing.
  As sideways, the screen follows the finger: the article moves with it, and
  the one letting go opens hangs just beyond its end (or top), its title and
  who wrote it showing as it comes into view, or saying there's none. Once
  the pull is far enough (or a quick flick), it says "Let go", and letting go
  carries straight on into it; short of that, it slides back.
-->
<script lang="ts">
  import type { Article } from "./shapes";
  import { flicked, leftAlone, reach, zoomed } from "./swipe";
  import { letGo, pull } from "./swipeMotion";
  import { sourceOf, writerOf } from "./people";

  let {
    area,
    previous,
    next,
    onPrevious,
    onNext,
  }: {
    /** The article's scrolling area, where a pull starts. */
    area: HTMLElement | undefined;
    previous?: Article;
    next?: Article;
    onPrevious: () => void;
    onNext: () => void;
  } = $props();

  /** Which way the pull goes: on past the end (the next hangs below), back past the top (the previous hangs above). */
  let going: "below" | "above" | undefined = $state();
  /** Whether letting go now opens it. */
  let far = $state(false);
  const onward = $derived(going === "above" ? previous : next);

  $effect(() => {
    if (!area) return;
    const within = area;
    const screen = within.closest("section") ?? within;

    // A pull past the end or the top, measured from where the finger was when the text could go no further that way
    // (the furthest it's been since, so turning back into the text only ever takes the pull away), and only on its own
    // side of where the stroke began, so a short article, at both ends at once, never takes a pull up and back for one down.
    const atEnd = () => within.scrollTop + within.clientHeight >= within.scrollHeight - 2;
    const atTop = () => within.scrollTop <= 0;
    let from = 0;
    let below: number | undefined;
    let above: number | undefined;
    let ignored = false;
    let pulled = 0;
    let last = { y: 0, at: 0 };
    let speed = 0;
    let settling = false;
    const start = (event: TouchEvent) => {
      pulled = speed = 0;
      from = event.touches[0]?.clientY ?? 0;
      // Already at an end, the pull counts from where the finger came down, so the article follows it exactly.
      below = atEnd() ? from : undefined;
      above = atTop() ? from : undefined;
      last = { y: from, at: event.timeStamp };
      ignored = settling || event.touches.length > 1 || zoomed() || leftAlone(event.target, within);
    };
    const move = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (ignored || y === undefined || event.touches.length > 1) return;
      if (event.timeStamp > last.at) speed = (y - last.y) / (event.timeStamp - last.at);
      last = { y, at: event.timeStamp };
      below = atEnd() ? Math.max(below ?? y, y) : undefined;
      above = atTop() ? Math.min(above ?? y, y) : undefined;
      const up = below !== undefined && y < from ? below - y : 0;
      const down = above !== undefined && y > from ? y - above : 0;
      const was = pulled;
      going = up > 0 ? "below" : down > 0 ? "above" : undefined;
      pulled = going === "below" ? -up : down;
      far = Math.abs(pulled) >= reach(within.clientWidth);
      // An ordinary scroll moves nothing; only a pull (or the end of one) does.
      if (pulled || was) pull(screen, pulled);
    };
    const end = () => {
      const way = going;
      const quick = !!way && flicked(Math.abs(pulled), way === "below" ? -speed : speed);
      const open = way === "above" ? (previous ? onPrevious : undefined) : way === "below" ? (next ? onNext : undefined) : undefined;
      below = above = undefined;
      if (!way) return;
      settling = true;
      // Far enough, it carries on a whole screen, so the article hung beyond fills it, and opens; short of that, back it goes.
      const go = open && (far || quick);
      letGo(screen, go ? (way === "below" ? -screen.clientHeight : screen.clientHeight) : 0, () => {
        going = undefined;
        far = false;
        settling = false;
        if (go) open();
      });
    };
    const cancel = () => {
      below = above = undefined;
      if (!going) return;
      settling = true;
      letGo(screen, 0, () => {
        going = undefined;
        far = false;
        settling = false;
      });
    };
    within.addEventListener("touchstart", start, { passive: true });
    within.addEventListener("touchmove", move, { passive: true });
    within.addEventListener("touchend", end);
    within.addEventListener("touchcancel", cancel);
    return () => {
      within.removeEventListener("touchstart", start);
      within.removeEventListener("touchmove", move);
      within.removeEventListener("touchend", end);
      within.removeEventListener("touchcancel", cancel);
    };
  });
</script>

{#if going}
  <!-- Hung just past the article's end or top, it moves with it; only seen, as the toolbar's Next and Previous say the same. -->
  <div aria-hidden="true" class="swipe-peek" data-side={going}>
    <div class="swipe-peek-text">
      {#if onward}
        <strong>{far ? (going === "above" ? "Let go for the previous" : "Let go for the next") : going === "above" ? "Previous" : "Next"}</strong>
        <span class="swipe-peek-title">{onward.title || "Untitled"}</span>
        <!-- Who wrote it, as its row names them: the writer, or else the feed (the writer comes first). -->
        <span class="swipe-card-by">{writerOf(onward) ?? sourceOf(onward, undefined)}</span>
      {:else}
        <strong>{going === "above" ? "That's the first article here." : "That's the last one so far."}</strong>
      {/if}
    </div>
  </div>
{/if}
