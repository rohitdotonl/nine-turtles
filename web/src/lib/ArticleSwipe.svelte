<!--
  An article's own swipes on a phone (SPEC section 20, decision 0274), as
  the toolbar's Previous and Next: swiped left, or pulled on up past its
  end, the next article opens; pulled on down past its top, the previous
  one. (Swiped right, it goes back to its list, as every screen does:
  `SwipeBack.svelte`.) Swiped left, the article follows the finger, slides
  off when it lets go far enough and the next one slides in from the right,
  or springs back (`swipeMotion.ts`); a pull moves only what the phone
  itself stretches, and the next or previous one slides in. Once the finger
  is far enough, a quiet card names the article letting go opens, or says
  there's none, and moving back takes it away.
-->
<script lang="ts">
  import type { Article } from "./shapes";
  import { leftAlone, reach, swipe } from "./swipe";
  import { follow, settle, slideIn } from "./swipeMotion";

  let {
    area,
    previous,
    next,
    onPrevious,
    onNext,
  }: {
    /** The article's scrolling area, where a swipe starts. */
    area: HTMLElement | undefined;
    previous?: Article;
    next?: Article;
    onPrevious: () => void;
    onNext: () => void;
  } = $props();

  /** Where letting go now goes: on by a swipe left, or by a pull past the end or the top. */
  let going: "left" | "below" | "above" | undefined = $state();
  const onward = $derived(going === "above" ? previous : next);

  /** A Svelte action: the card is drawn by the page, not inside the article that moves. */
  function toBody(node: HTMLElement) {
    document.body.append(node);
    return { destroy: () => node.remove() };
  }

  function arrive(way: typeof going) {
    if (way === "above" && previous) onPrevious();
    else if (way && way !== "above" && next) onNext();
  }

  $effect(() => {
    if (!area) return;
    const within = area;
    const far = () => reach(within.clientWidth);
    /** The whole article, toolbar and all: what a sideways stroke drags. */
    const screen = { screen: within.closest("section") ?? within };
    const action = swipe(within, {
      side: -1,
      moved: (dx) => {
        follow(screen, dx);
        going = -dx >= far() ? "left" : undefined;
      },
      ended: (dx) => {
        going = undefined;
        const on = -dx >= far() && next !== undefined;
        settle(screen, on ? -innerWidth : 0, () => {
          if (!on) return;
          arrive("left");
          slideIn(screen.screen);
        });
      },
      allowed: (event) => !leftAlone(event.target, within),
    });

    // A pull past the end or the top, measured from where the finger was when the text could go no further that way
    // (the furthest it's been since, so turning back into the text only ever takes the pull away).
    let below: number | undefined;
    let above: number | undefined;
    let ignored = false;
    const start = (event: TouchEvent) => {
      below = above = undefined;
      ignored = event.touches.length > 1 || leftAlone(event.target, within);
    };
    const move = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (ignored || y === undefined || event.touches.length > 1 || going === "left") return;
      below = within.scrollTop + within.clientHeight >= within.scrollHeight - 2 ? Math.max(below ?? y, y) : undefined;
      above = within.scrollTop <= 0 ? Math.min(above ?? y, y) : undefined;
      going = below !== undefined && below - y >= far() ? "below" : above !== undefined && y - above >= far() ? "above" : undefined;
    };
    const end = () => {
      const way = going === "left" ? undefined : going;
      below = above = undefined;
      if (!way) return;
      going = undefined;
      const there = way === "above" ? previous : next;
      arrive(way);
      if (there) slideIn(screen.screen, way === "above" ? -1 : 1);
    };
    const cancel = () => {
      below = above = undefined;
      if (going !== "left") going = undefined;
    };
    within.addEventListener("touchstart", start, { passive: true });
    within.addEventListener("touchmove", move, { passive: true });
    within.addEventListener("touchend", end);
    within.addEventListener("touchcancel", cancel);
    return () => {
      action.destroy();
      within.removeEventListener("touchstart", start);
      within.removeEventListener("touchmove", move);
      within.removeEventListener("touchend", end);
      within.removeEventListener("touchcancel", cancel);
    };
  });
</script>

{#if going}
  <!-- Kept by the page itself, so it stays put while the article under it follows the finger. -->
  <div use:toBody aria-hidden="true" class="swipe-card" data-side={going === "left" ? "next" : going}>
    {#if onward}
      <strong>{going === "above" ? "Previous" : "Next"}</strong>{onward.title || "Untitled"}
    {:else}
      <strong>{going === "above" ? "That's the first article here." : "That's the last one so far."}</strong>
    {/if}
  </div>
{/if}
