// The third place nine turtles moves by itself (DESIGN.md → Exceptions log,
// decision 0298): the article's title arriving in the computer's top bar once
// the title itself has scrolled away fades in over 0.15 seconds, so it reads
// as the same title following you rather than a flash. It leaves at once. A
// reader who asks for reduced motion sees it appear at once, as everything
// else does. `scripts/check-motion.mjs` allows motion here, in `breathe.ts`
// and in `swipeMotion.ts`, and nowhere else.

/** Short enough never to make anyone wait; long enough to read as arriving. */
export const FADE_MS = 150;

/** A Svelte action: the element fades in once, as it's put on the page. */
export function fadeIn(element: HTMLElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "cubic-bezier(0, 0, 0.58, 1)" });
}
