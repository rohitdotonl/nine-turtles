// The one place nine turtles moves by itself (DESIGN.md → Exceptions log,
// decision 0274): when a finger lets go of a swipe, the screen it was
// dragging finishes the stroke. Gone far enough, it slides the rest of the
// way off; not far enough, it springs back. An article opened by a pull past
// its end or top comes in the way it was pulled. While the finger is down, everything follows it exactly, as the
// reader moves it. A phone set to reduce motion gets no glide: everything
// lands at once, as every other part of the app does. `scripts/check-motion.mjs`
// allows motion in this file and nowhere else.

/** How long letting go takes to finish: about a third of a second, quick enough not to wait for. */
export const SETTLE_MS = 320;
/** Fast at first, then easing to rest, so it carries on from the finger's own speed. */
const GLIDE = `${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
/** How much of the screen behind is held back while it's covered, so it seems to lie beneath. */
const BEHIND = 0.3;
/** How dark the screen behind is while it's covered; lit fully once it's uncovered. */
const DIM = 0.88;

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The inline styles this file sets, cleared again once a stroke is done. */
const SET = ["transition", "transform", "position", "inset", "width", "zIndex", "boxShadow", "filter", "display"] as const;
function clear(node: HTMLElement) {
  for (const key of SET) node.style[key] = "";
}

/** Changes made by `change` glide over `SETTLE_MS` (at once with reduced motion); then `done`. */
function glide(nodes: (HTMLElement | undefined)[], change: () => void, done: () => void) {
  const quiet = still();
  for (const node of nodes) if (node) node.style.transition = quiet ? "" : `transform ${GLIDE}, filter ${GLIDE}, width ${GLIDE}`;
  change();
  if (quiet) done();
  else setTimeout(done, SETTLE_MS);
}

/** A screen being dragged, and the one shown behind it (if it's known), which was hidden until the drag. */
export type Panes = { screen: HTMLElement; behind?: HTMLElement; wasHidden?: boolean };

/** Where the stroke drags `screen` to `dx`: it floats over the screen behind, which lies a little held back and dimmed until uncovered. */
export function follow(panes: Panes, dx: number) {
  const { screen, behind } = panes;
  if (behind && panes.wasHidden === undefined) {
    panes.wasHidden = behind.hidden === true;
    behind.hidden = false;
    // The whole screen's width, as it will be once it's the screen, not the narrower pane it is beside others.
    Object.assign(behind.style, { display: "flex", position: "fixed", inset: "0", width: "100%", zIndex: "0" });
  }
  Object.assign(screen.style, { transition: "", position: "relative", zIndex: "2", transform: `translateX(${dx}px)`, boxShadow: dx ? "var(--shadow-float)" : "" });
  if (!behind) return;
  const uncovered = Math.min(1, Math.abs(dx) / innerWidth);
  Object.assign(behind.style, { transition: "", transform: `translateX(${-BEHIND * innerWidth * (1 - uncovered)}px)`, filter: `brightness(${DIM + (1 - DIM) * uncovered})` });
}

/** Lets go: `screen` glides to `to` (0 is back where it was; the screen's width is off it), then everything is put back as it was and `done` runs. */
export function settle(panes: Panes, to: number, done: () => void) {
  const { screen, behind } = panes;
  glide(
    [screen, behind],
    () => {
      screen.style.transform = `translateX(${to}px)`;
      if (behind) {
        behind.style.transform = to ? "translateX(0)" : `translateX(${-BEHIND * innerWidth}px)`;
        behind.style.filter = to ? "none" : `brightness(${DIM})`;
      }
    },
    () => {
      clear(screen);
      if (behind) {
        clear(behind);
        if (panes.wasHidden) behind.hidden = true;
      }
      panes.wasHidden = undefined;
      done();
    },
  );
}

/** Where a new screen comes in from: the way the finger sent the last one. */
const FROM = { below: () => `translateY(${innerHeight}px)`, above: () => `translateY(${-innerHeight}px)` };

/** A new article slides in from `from`: from below after a pull up past the end, from above after a pull down past the top. */
export function slideIn(screen: HTMLElement, from: keyof typeof FROM) {
  if (still()) return;
  Object.assign(screen.style, { transition: "", position: "relative", transform: FROM[from]() });
  // Laid out where it starts, so the glide has somewhere to go from.
  void screen.offsetWidth;
  glide([screen], () => (screen.style.transform = "none"), () => clear(screen));
}

/** A row let go of springs back under the finger's room (`room`, which closes as it does); `change` puts them back, then `done`. */
export function springBack(row: HTMLElement, room: HTMLElement | undefined, change: () => void, done: () => void) {
  glide([row, room], change, () => {
    row.style.transition = "";
    if (room) room.style.transition = "";
    done();
  });
}
