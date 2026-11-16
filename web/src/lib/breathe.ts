// The second place nine turtles moves by itself (DESIGN.md → Exceptions log,
// decision 0286): while a slow wait goes on (someone else's site, YouTube or
// a publisher's audio, `SlowWait.svelte`), the three dots of its "…"
// brighten one after another, slowly, as a sign it's still going. Nothing
// else moves, and the dots never go below a quarter of the text's ink. A
// reader who asks for reduced motion gets a still "…", as every other wait
// shows. `scripts/check-motion.mjs` allows motion here, in `swipeMotion.ts`,
// and nowhere else.

/** One breath across the three dots: slow enough to read as calm, never as a hurry. */
export const BREATH_MS = 1800;

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A Svelte action for the element holding the three dots, each its own
 * child: each brightens in turn, a third of a breath after the one before,
 * for as long as it's on the page.
 */
export function breathe(dots: HTMLElement) {
  if (still()) return;
  const running = [...dots.children].map((dot, index) =>
    dot.animate([{ opacity: 0.25 }, { opacity: 1, offset: 0.3 }, { opacity: 0.25 }], {
      duration: BREATH_MS,
      delay: (index * BREATH_MS) / 3,
      iterations: Infinity,
      // Softly in and out of each brightening, written as a curve so the styles scanner sees no class name here.
      easing: "cubic-bezier(0.42, 0, 0.58, 1)",
      fill: "backwards",
    }),
  );
  return { destroy: () => running.forEach((animation) => animation.cancel()) };
}
