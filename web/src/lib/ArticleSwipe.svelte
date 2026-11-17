<!--
  An article's own pulls on a phone (SPEC section 20, decisions 0274, 0276
  and 0280), as the toolbar's Previous and Next: pulled on up past its end,
  the next article; pulled on down past its top, the previous one. Sideways
  is only for going back (`SwipeBack.svelte`), so each way means one thing.
  As sideways, the screen follows the finger: the article moves with it, and
  just beyond its end (or top) an arrow comes into view, the toolbar's own ↓
  (or ↑), or words saying there's none. Once the pull is far enough, the
  arrow sits in a filled circle (decision 0304), and letting go carries
  straight on into the next article; short of that, it slides back. A pull is firm on purpose
  (decision 0303): only a stroke that starts at the end (or top) pulls, never
  a scroll that reaches it on the way, and no flick counts, so reading on
  never opens another article by itself. While a menu or
  sheet is open (Write back's ways, the Aa sheet), the stroke that closes it
  only scrolls.
-->
<script lang="ts">
  import type { Article } from "./shapes";
  import { DECIDE, leftAlone, somethingOpen, zoomed } from "./swipe";
  import { letGo, pull } from "./swipeMotion";
  import Icon from "./Icon.svelte";

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

  /** Which way the pull goes: on past the end (its arrow shows below), back past the top (its arrow shows above). */
  let going: "below" | "above" | undefined = $state();
  /** Whether letting go now opens it. */
  let far = $state(false);
  const onward = $derived(going === "above" ? previous : next);
  /** How far a pull goes before letting go opens it: further than a row's swipe, so it's always meant. */
  const PULL = 160;

  $effect(() => {
    if (!area) return;
    const within = area;
    const screen = within.closest("section") ?? within;

    // A pull past the end or the top, only from a stroke that began there (a scroll that reaches an end on its way
    // stops there, and a new stroke pulls), measured from the furthest the finger has been since, so turning back
    // into the text only ever takes the pull away, and only on its own side of where the stroke began, so a short
    // article, at both ends at once, never takes a pull up and back for one down.
    const atEnd = () => within.scrollTop + within.clientHeight >= within.scrollHeight - 2;
    const atTop = () => within.scrollTop <= 0;
    let from = { x: 0, y: 0 };
    let below: number | undefined;
    let above: number | undefined;
    let ignored = false;
    /** Whether the stroke has gone far enough to be up and down (a pull may start) rather than sideways (back's). */
    let decided = false;
    let pulled = 0;
    let settling = false;
    /** A menu or sheet was open as the finger came down: the touch closes it, and does nothing more. */
    let closing = false;
    const landed = () => (closing = somethingOpen());
    const start = (event: TouchEvent) => {
      pulled = 0;
      decided = false;
      const touch = event.touches[0];
      from = { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
      // Already at an end, the pull counts from where the finger came down, so the article follows it exactly.
      below = atEnd() ? from.y : undefined;
      above = atTop() ? from.y : undefined;
      ignored = settling || closing || event.touches.length > 1 || zoomed() || leftAlone(event.target, within);
    };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (ignored || !touch || event.touches.length > 1) return;
      const { clientX: x, clientY: y } = touch;
      // Decided as the swipes are: whichever way the finger first goes DECIDE pixels. Sideways, it's back's, not a pull.
      if (!decided) {
        if (Math.abs(x - from.x) < DECIDE && Math.abs(y - from.y) < DECIDE) return;
        if (Math.abs(x - from.x) > Math.abs(y - from.y)) return void (ignored = true);
        decided = true;
      }
      // While pulled, the text can't scroll (below), so it stays at its end and the pull follows the finger back as well as on.
      below = below !== undefined && atEnd() ? Math.max(below, y) : undefined;
      above = above !== undefined && atTop() ? Math.min(above, y) : undefined;
      const up = below !== undefined && y < from.y ? below - y : 0;
      const down = above !== undefined && y > from.y ? y - above : 0;
      const was = pulled;
      going = up > 0 ? "below" : down > 0 ? "above" : undefined;
      pulled = going === "below" ? -up : down;
      far = Math.abs(pulled) >= PULL;
      // An ordinary scroll moves nothing; only a pull (or the end of one) does, and while it does, the text stays still.
      if (pulled || was) pull(screen, pulled);
      if (pulled && event.cancelable) event.preventDefault();
    };
    const end = () => {
      const way = going;
      below = above = undefined;
      if (ignored || !way) return;
      const open = way === "above" ? (previous ? onPrevious : undefined) : next ? onNext : undefined;
      settling = true;
      // Far enough, it carries on a whole screen and the next (or previous) one opens; short of that, back it goes.
      const go = open && far;
      letGo(screen, go ? (way === "below" ? -screen.clientHeight : screen.clientHeight) : 0, () => {
        going = undefined;
        far = false;
        settling = false;
        if (go) open();
      });
    };
    const cancel = () => {
      below = above = undefined;
      if (ignored || !going) return;
      settling = true;
      letGo(screen, 0, () => {
        going = undefined;
        far = false;
        settling = false;
      });
    };
    within.addEventListener("pointerdown", landed, { capture: true });
    within.addEventListener("touchstart", start, { passive: true });
    // Not passive: while pulled, the text mustn't scroll under the finger.
    within.addEventListener("touchmove", move, { passive: false });
    within.addEventListener("touchend", end);
    within.addEventListener("touchcancel", cancel);
    return () => {
      within.removeEventListener("pointerdown", landed, { capture: true });
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
    {#if onward}
      <!-- The toolbar's own arrow; far enough, it sits in a filled circle, so letting go is shown by shape as well as tone. -->
      <span class="swipe-peek-arrow" data-far={far || undefined}><Icon name={going === "above" ? "chevron-up" : "chevron-down"} size="alone" /></span>
    {:else}
      <p class="swipe-peek-text">{going === "above" ? "That's the first article here." : "That's the last one so far."}</p>
    {/if}
  </div>
{/if}
