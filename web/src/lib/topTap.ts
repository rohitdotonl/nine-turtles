// Tapping the top of an iPhone's screen scrolls back to the top (decision
// 0237), as in every app there. iOS does it only for the page itself, and
// nine turtles' screens scroll inside panes, so the page never moved and
// the tap did nothing. Here the page is one pixel taller than the screen and
// rests one pixel down; when the tap brings it to its top, the pane on screen
// goes to its top at once (nothing animates), and the page goes back down
// its pixel, ready for the next tap. A finger on the screen moves the page
// too (dragging the top bar, say), so a move during a touch, or just after
// one while the page coasts, is put back without touching the pane: the top
// tap is the one move with no touch.

/** An iPhone or iPad (iPadOS says it's a Mac, but has a touch screen). */
const onIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/.test(navigator.platform) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const TOUCHES = ["touchstart", "touchend", "touchcancel"] as const;
/** How long the page may still be coasting after a finger leaves it. */
const COASTING_MS = 800;

/** The panes that scroll and are on screen now: on a phone, one at a time. */
function panesShown(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(".scroller")].filter((pane) => pane.offsetParent !== null && pane.scrollTop > 0);
}

/** On an iPhone or iPad, starts listening for the top tap; returns the way to stop. */
export function topTapScrolls(): (() => void) | undefined {
  if (!onIOS()) return undefined;
  const body = document.body;
  body.style.minHeight = "calc(100dvh + 1px)";
  const rest = () => {
    if (scrollY < 1) scrollTo(0, 1);
  };
  let touches = 0;
  let touchedAt = -Infinity;
  const touched = (event: TouchEvent) => {
    touches = event.touches.length;
    touchedAt = event.timeStamp;
  };
  const scrolled = (event: Event) => {
    if (scrollY > 0) return;
    if (touches === 0 && event.timeStamp - touchedAt > COASTING_MS) for (const pane of panesShown()) pane.scrollTop = 0;
    requestAnimationFrame(rest);
  };
  rest();
  addEventListener("scroll", scrolled, { passive: true });
  for (const kind of TOUCHES) addEventListener(kind, touched, { passive: true, capture: true });
  return () => {
    removeEventListener("scroll", scrolled);
    for (const kind of TOUCHES) removeEventListener(kind, touched, { capture: true });
    body.style.minHeight = "";
    scrollTo(0, 0);
  };
}
