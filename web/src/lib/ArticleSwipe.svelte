<!--
  An article's own pulls on a phone (SPEC section 20, decisions 0274, 0276), as the
  toolbar's Previous and Next: pulled on up past its end, the next article
  opens, rising from below; pulled on down past its top, the previous one,
  coming down from above (`swipeMotion.ts`). Sideways is only for going back
  (`SwipeBack.svelte`), so each way means one thing. Nothing moves during the
  pull but what the phone itself stretches; once the finger is far enough, a
  quiet card names the article letting go opens and who wrote it, or says
  there's none, and moving back takes it away (decision 0276).
-->
<script lang="ts">
  import type { Article } from "./shapes";
  import { leftAlone, reach, zoomed } from "./swipe";
  import { slideIn } from "./swipeMotion";
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

  /** Where letting go now goes: on by a pull past the end, back by a pull past the top. */
  let going: "below" | "above" | undefined = $state();
  const onward = $derived(going === "above" ? previous : next);

  $effect(() => {
    if (!area) return;
    const within = area;
    const far = () => reach(within.clientWidth);

    // A pull past the end or the top, measured from where the finger was when the text could go no further that way
    // (the furthest it's been since, so turning back into the text only ever takes the pull away), and only on its own
    // side of where the stroke began, so a short article, at both ends at once, never takes a pull up and back for one down.
    let from = 0;
    let below: number | undefined;
    let above: number | undefined;
    let ignored = false;
    const start = (event: TouchEvent) => {
      below = above = undefined;
      from = event.touches[0]?.clientY ?? 0;
      ignored = event.touches.length > 1 || zoomed() || leftAlone(event.target, within);
    };
    const move = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (ignored || y === undefined || event.touches.length > 1) return;
      below = within.scrollTop + within.clientHeight >= within.scrollHeight - 2 ? Math.max(below ?? y, y) : undefined;
      above = within.scrollTop <= 0 ? Math.min(above ?? y, y) : undefined;
      going = below !== undefined && y < from && below - y >= far() ? "below" : above !== undefined && y > from && y - above >= far() ? "above" : undefined;
    };
    const end = () => {
      const way = going;
      below = above = undefined;
      going = undefined;
      if (way === "above" && previous) onPrevious();
      else if (way === "below" && next) onNext();
      else return;
      // The whole article, toolbar and all, comes in the way it was pulled.
      slideIn(within.closest("section") ?? within, way);
    };
    const cancel = () => {
      below = above = undefined;
      going = undefined;
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
  <div aria-hidden="true" class="swipe-card" data-side={going}>
    {#if onward}
      <strong>{going === "above" ? "Previous" : "Next"}</strong>{onward.title || "Untitled"}
      <!-- Who wrote it, as its row names them: the writer, or else the feed (the writer comes first). -->
      <span class="swipe-card-by">{writerOf(onward) ?? sourceOf(onward, undefined)}</span>
    {:else}
      <strong>{going === "above" ? "That's the first article here." : "That's the last one so far."}</strong>
    {/if}
  </div>
{/if}
