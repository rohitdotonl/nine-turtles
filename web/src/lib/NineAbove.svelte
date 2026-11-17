<!--
  The nine above a list (decision 0302): on a phone, a list pulled down past
  its top shows the nine turtles waiting above it, one more for every bit
  further the finger goes, and once all nine are there, when nine turtles last
  looked for new writing. Nothing refreshes and nothing else happens: it's
  only for the reader who pulls (DESIGN.md → "Easter eggs"). The drawing is
  the logo's turtle, unchanged and still, in the page's ink; the list moves
  only with the finger, and when it lifts, the list glides back
  (`swipeMotion.ts`, at once with reduced motion). Sideways strokes stay the
  swipes'.
-->
<script lang="ts">
  import { HOLD_MS } from "./sidebarDrag";
  import { DECIDE, leftAlone, somethingOpen, zoomed } from "./swipe";
  import { letGo, pull } from "./swipeMotion";
  import { lastChecked } from "./times";

  let {
    area,
    feeds,
  }: {
    /** The list's scrolling area, which a pull drags down. */
    area: HTMLElement | undefined;
    /** The reader's feeds, for when nine turtles last looked at any of them. */
    feeds: { checkedAt?: number | null }[] | undefined;
  } = $props();

  const checkedAt = $derived(feeds?.reduce<number | null>((latest, feed) => (feed.checkedAt && feed.checkedAt > (latest ?? 0) ? feed.checkedAt : latest), null) ?? null);

  /** How far the list follows the finger: half, so the pull feels held, as a phone's own stretch does. */
  const GIVE = 0.5;
  /** The furthest the list goes, enough room for the nine and their line. */
  const ROOM = 128;
  /** How far the list goes for each turtle to come out. */
  const STEP = 12;

  /** How far the list is pulled down now. */
  let pulled = $state(0);
  const shown = $derived(Math.min(9, Math.floor(pulled / STEP)));

  $effect(() => {
    if (!area) return;
    const within = area;
    let from = { x: 0, y: 0 };
    let startedAt = 0;
    let above: number | undefined;
    let ignored = false;
    let decided = false;
    let settling = false;
    let closing = false;
    const landed = () => (closing = somethingOpen());
    const start = (event: TouchEvent) => {
      const touch = event.touches[0];
      from = { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
      startedAt = event.timeStamp;
      decided = false;
      // Only a stroke that starts with the list at its top can pull: one that starts scrolled down only scrolls.
      above = within.scrollTop <= 0 ? from.y : undefined;
      ignored = above === undefined || settling || closing || event.touches.length > 1 || zoomed() || leftAlone(event.target, within);
    };
    const move = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (ignored || !touch || event.touches.length > 1) return;
      const { clientX: x, clientY: y } = touch;
      if (!decided) {
        if (Math.abs(x - from.x) < DECIDE && Math.abs(y - from.y) < DECIDE) return;
        // Sideways is the swipes'; held long enough, the row's menu opened, and the stroke is the menu's.
        if (Math.abs(x - from.x) > Math.abs(y - from.y) || somethingOpen() || event.timeStamp - startedAt > HOLD_MS) return void (ignored = true);
        decided = true;
      }
      // Counted from the furthest up the finger has been, so turning back only ever takes the pull away; scrolled down, no pull.
      if (above !== undefined) above = within.scrollTop <= 0 ? Math.min(above, y) : undefined;
      const was = pulled;
      const down = above !== undefined && y > above ? y - above : 0;
      pulled = Math.min(ROOM, down * GIVE);
      if (pulled || was) {
        // Opaque while it moves, so the nine show only in the room it opens above.
        within.style.backgroundColor = pulled ? "var(--paper)" : "";
        pull(within, pulled);
      }
      if (pulled && event.cancelable) event.preventDefault();
    };
    const end = () => {
      above = undefined;
      if (ignored || !pulled) return;
      settling = true;
      letGo(within, 0, () => {
        pulled = 0;
        within.style.backgroundColor = "";
        settling = false;
      });
    };
    within.addEventListener("pointerdown", landed, { capture: true });
    within.addEventListener("touchstart", start, { passive: true });
    // Not passive: while pulled, the list mustn't scroll under the finger.
    within.addEventListener("touchmove", move, { passive: false });
    within.addEventListener("touchend", end);
    within.addEventListener("touchcancel", end);
    return () => {
      within.removeEventListener("pointerdown", landed, { capture: true });
      within.removeEventListener("touchstart", start);
      within.removeEventListener("touchmove", move);
      within.removeEventListener("touchend", end);
      within.removeEventListener("touchcancel", end);
    };
  });
</script>

{#if pulled > 0}
  <!-- Only seen: it's a small surprise for the reader who pulls, and the line says nothing a list doesn't (decision 0302). -->
  <div aria-hidden="true" class="nine-above" style:height="{pulled}px">
    <svg viewBox="0 0 300 20" width="300" height="20" fill="currentColor">
      {#each { length: shown } as _, i (i)}
        <g transform="translate({14 + i * 33} 12)"><path d="M-9 3.5 A7.5 7.5 0 0 1 6 3.5 Z" /><circle cx="8.6" cy="0.6" r="2" /></g>
      {/each}
    </svg>
    {#if shown === 9 && checkedAt !== null}<p>{lastChecked(checkedAt)}</p>{/if}
  </div>
{/if}

<style>
  .nine-above {
    position: absolute;
    top: 100%;
    inset-inline: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    overflow: hidden;
    color: var(--ink);
    pointer-events: none;
  }
  .nine-above svg {
    max-width: calc(100% - 2.5rem);
    height: auto;
  }
  .nine-above p {
    margin: 0;
    font-size: var(--text-meta);
    line-height: var(--text-meta--line-height);
    color: var(--ink-2);
  }
</style>
