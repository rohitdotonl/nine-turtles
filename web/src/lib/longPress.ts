// A long press on a touch screen (SPEC section 6, decision 0214): a row's
// menu opens after half a second held still, as on a phone's own lists. The
// tap that ends it doesn't also open the row, and the phone's own callout
// (copy, share) stays away. A computer's right-click is the browser's own.

// Held as long, and as still, as a row lifted in the sidebar's Edit (`sidebarDrag.ts`).
import { FINGER_SLOP, HOLD_MS } from "./sidebarDrag";

export function longPress(node: HTMLElement, onHold: (x: number, y: number) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start = { x: 0, y: 0 };
  let held = false;
  node.style.setProperty("-webkit-touch-callout", "none");

  const stop = () => clearTimeout(timer);
  const down = (event: PointerEvent) => {
    held = false;
    if (event.pointerType !== "touch") return;
    start = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      held = true;
      onHold(start.x, start.y);
    }, HOLD_MS);
  };
  const move = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > FINGER_SLOP) stop();
  };
  const click = (event: MouseEvent) => {
    if (!held) return;
    held = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", stop);
  node.addEventListener("pointercancel", stop);
  node.addEventListener("click", click, true);
  return {
    update(next: (x: number, y: number) => void) {
      onHold = next;
    },
    destroy() {
      stop();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", stop);
      node.removeEventListener("pointercancel", stop);
      node.removeEventListener("click", click, true);
    },
  };
}
