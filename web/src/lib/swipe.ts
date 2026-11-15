// Swipes on a touch screen (SPEC section 20, decision 0274), one rule: a
// finger swiped right goes back, as the back button does, and swiped left
// goes on (the next article, or what a row's menu does to it). Each is only
// a shortcut for a button that's already there. Only a finger counts, never
// a mouse or a pen; a stroke more up and down than sideways is a scroll, and
// one at the screen's right edge is the phone's own. While the finger moves,
// what follows it is the reader moving it; once it lifts, the stroke finishes
// with a short glide (`swipeMotion.ts`, DESIGN.md → Exceptions log).

import { HOLD_MS } from "./sidebarDrag";

/** Pixels at each side of the screen kept for the phone's own gestures. */
export const EDGE = 24;
/** How far a finger moves before it counts as sideways or as a scroll. */
const DECIDE = 10;
/** A finger lifted moving faster than this (pixels a millisecond, 600 a second) has flicked: a short swipe counts, as on every phone. */
const FLICK = 0.6;

export type SwipeHands = {
  /** The one way this place takes a swipe: 1 is right (back), -1 is left (on). */
  side: 1 | -1;
  /**
   * Whether a stroke may start at the screen's left edge. In Safari that edge
   * is the browser's own back; an app on the home screen has none (iOS gives
   * it none, and Android's own takes the edge before the page hears of it).
   */
  fromEdge?: boolean;
  /** The finger's distance sideways from where it started, while it's down. */
  moved(dx: number): void;
  /** The stroke ended with the finger lifted this far sideways (0 when the browser took it away). */
  ended(dx: number): void;
  /** Whether a stroke may start on this press. */
  allowed?(event: PointerEvent): boolean;
};

/** How far a finger has to go for a swipe to count: a third of the width, at most 120px. */
export function reach(width: number): number {
  return Math.min(width / 3, 120);
}

/** What a finger moves by itself: a swipe never starts on one. */
const FIELDS = "input, textarea, select, [role=slider]";

/**
 * Presses a swipe leaves alone: in something that scrolls sideways itself (a
 * wide table, a block of code), a field, a player or embedded page, or an open
 * sheet or menu.
 */
export function leftAlone(target: EventTarget | null, within: HTMLElement): boolean {
  const start = target instanceof Element ? target : null;
  if (start?.closest(`${FIELDS}, [contenteditable], audio, video, iframe, dialog, [role=dialog], [role=menu]`)) return true;
  for (let node = start; node && node !== within; node = node.parentElement) {
    const { overflowX } = getComputedStyle(node);
    if ((overflowX === "auto" || overflowX === "scroll") && node.scrollWidth > node.clientWidth) return true;
  }
  return false;
}

/** Strokes a place nearer the finger has taken, so the places around it leave them alone. */
const taken = new Set<number>();

const standalone = () => matchMedia("(display-mode: standalone)").matches;

/** A Svelte action: `use:swipe={hands}`. Up-and-down scrolling and zooming stay the browser's. */
export function swipe(node: HTMLElement, hands: SwipeHands) {
  let start: { x: number; y: number; id: number; at: number } | undefined;
  let sideways = false;
  /** Where the finger was lately, to tell a flick from a slow lift. */
  let lately: { x: number; at: number }[] = [];
  let swallowClick = false;
  node.style.touchAction = "pan-y pinch-zoom";

  const giveUp = () => {
    if (sideways) hands.ended(0);
    if (sideways && start) taken.delete(start.id);
    start = undefined;
    sideways = false;
  };
  const down = (event: PointerEvent) => {
    swallowClick = false;
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    if (event.clientX > innerWidth - EDGE || (event.clientX < EDGE && !(hands.fromEdge && standalone()))) return;
    if (hands.allowed && !hands.allowed(event)) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId, at: event.timeStamp };
    sideways = false;
    lately = [{ x: event.clientX, at: event.timeStamp }];
  };
  const move = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!sideways) {
      if (Math.abs(dy) > DECIDE && Math.abs(dy) >= Math.abs(dx)) return giveUp();
      if (Math.abs(dx) < DECIDE || Math.abs(dx) < 2 * Math.abs(dy)) return;
      // The other way, taken by a place nearer the finger, after a hold long enough for a row's menu, or while words are chosen: not this swipe.
      if (Math.sign(dx) !== hands.side || taken.has(start.id) || event.timeStamp - start.at > HOLD_MS || !(getSelection()?.isCollapsed ?? true)) {
        start = undefined;
        return;
      }
      sideways = true;
      taken.add(start.id);
    }
    lately = [...lately.filter((seen) => event.timeStamp - seen.at < 100), { x: event.clientX, at: event.timeStamp }];
    // Back past where it started is no further than where it started.
    hands.moved(hands.side * Math.max(0, hands.side * dx));
  };
  const up = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id) return;
    const was = sideways;
    const dx = event.clientX - start.x;
    giveUp();
    if (!was) return;
    // A flick the swipe's way (at least 20px) counts as far enough, however short.
    const first = lately[0];
    const speed = first && event.timeStamp > first.at ? (event.clientX - first.x) / (event.timeStamp - first.at) : 0;
    const gone = Math.max(0, hands.side * dx);
    hands.ended(hands.side * (hands.side * speed >= FLICK && gone >= 2 * DECIDE ? Math.max(gone, reach(node.clientWidth || innerWidth)) : gone));
    // The press that ends a swipe doesn't also open what it started on (what the swipe presses itself, once it's glided, is let through).
    swallowClick = true;
  };
  const click = (event: MouseEvent) => {
    if (!swallowClick || !event.isTrusted) return;
    swallowClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", giveUp);
  node.addEventListener("click", click, true);
  return {
    update(next: SwipeHands) {
      hands = next;
    },
    destroy() {
      node.style.touchAction = "";
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", giveUp);
      node.removeEventListener("click", click, true);
    },
  };
}

/**
 * A Svelte action: a sheet swiped down closes, as sheets do on a phone
 * (decision 0274), only from where its own scrolling is at the top, and
 * never on a field or slider. Nothing follows the finger; it closes when the
 * finger lifts far enough down.
 */
export function swipeDown(node: HTMLElement, close: () => void) {
  let start: { x: number; y: number } | undefined;
  const down = (event: TouchEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    const touch = event.touches[0];
    start = touch && event.touches.length === 1 && node.scrollTop <= 0 && !target?.closest(FIELDS) ? { x: touch.clientX, y: touch.clientY } : undefined;
  };
  const up = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    start = undefined;
    if (dy >= reach(innerWidth) && dy > 2 * Math.abs(dx) && node.scrollTop <= 0) close();
  };
  const cancel = () => (start = undefined);
  node.addEventListener("touchstart", down, { passive: true });
  node.addEventListener("touchend", up);
  node.addEventListener("touchcancel", cancel);
  return {
    update(next: () => void) {
      close = next;
    },
    destroy() {
      node.removeEventListener("touchstart", down);
      node.removeEventListener("touchend", up);
      node.removeEventListener("touchcancel", cancel);
    },
  };
}
