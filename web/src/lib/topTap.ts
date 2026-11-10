// Tapping the top of an iPhone's screen scrolls back to the top (decision
// 0237), as in every app there. iOS does it only for the page itself, and
// nine turtles' screens scroll inside panes, so the page never moved and
// the tap did nothing. Here the page has one spare pixel above the app and
// rests one pixel down, so the app fills the screen exactly; when the tap
// brings the page to its top, what's on screen (an open sheet, or else the
// pane) goes to its top at once (nothing animates), and the page goes back
// down its pixel, ready for the next tap. A finger on the screen moves the
// page too (dragging the top bar, say), so a move during a touch, or just
// after one while the page coasts, or while typing (the keyboard closing),
// is put back without touching anything: the top tap is the one move with
// no touch.

import { deviceOf } from "./install";

const onIOS = () => ["iphone", "ipad"].includes(deviceOf(navigator).platform);

const TOUCHES = ["touchstart", "touchend", "touchcancel"] as const;
/** How long the page may still be coasting after a finger leaves it. */
const COASTING_MS = 800;

/** What the tap brings to its top: an open sheet, or else the panes on screen (on a phone, one at a time). */
function onScreen(): HTMLElement[] {
  const sheet = document.querySelector<HTMLElement>("dialog[open]");
  if (sheet) return [sheet, ...sheet.querySelectorAll<HTMLElement>("*")].filter((part) => part.scrollTop > 0);
  return [...document.querySelectorAll<HTMLElement>(".scroller")].filter((pane) => pane.offsetParent !== null && pane.scrollTop > 0);
}

/** Whether the reader is typing: the keyboard is up, and closing it may move the page. */
function typing(): boolean {
  const at = document.activeElement;
  return at instanceof HTMLElement && (at.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(at.tagName));
}

/** On an iPhone or iPad, starts listening for the top tap; returns the way to stop. */
export function topTapScrolls(): (() => void) | undefined {
  if (!onIOS()) return undefined;
  const body = document.body;
  body.style.paddingTop = "1px";
  let touches = 0;
  let touchedAt = -Infinity;
  let frame = 0;
  const rest = () => {
    if (touches === 0 && scrollY < 1) scrollTo(0, 1);
  };
  const touched = (event: TouchEvent) => {
    touches = event.touches.length;
    touchedAt = event.timeStamp;
    rest();
  };
  const scrolled = (event: Event) => {
    if (scrollY > 0) return;
    if (touches === 0 && event.timeStamp - touchedAt > COASTING_MS && !typing()) for (const part of onScreen()) part.scrollTop = 0;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(rest);
  };
  rest();
  addEventListener("scroll", scrolled, { passive: true });
  for (const kind of TOUCHES) addEventListener(kind, touched, { passive: true, capture: true });
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener("scroll", scrolled);
    for (const kind of TOUCHES) removeEventListener(kind, touched, { capture: true });
    body.style.paddingTop = "";
    scrollTo(0, 0);
  };
}
