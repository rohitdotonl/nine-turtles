/**
 * A hairline at the top of a scrolling area once its content has scrolled
 * up under the fixed line above it, and none at rest (app.css → `.scroller`).
 * Use as `use:edge` on the scrolling element.
 */
export function edge(node: HTMLElement) {
  const update = () => {
    if (node.scrollTop > 0) node.dataset.scrolled = "";
    else delete node.dataset.scrolled;
  };
  // Checked just before the next frame, not while the screen is still being built: reading
  // the scroll place then would make the browser lay the page out an extra time (decision 0314).
  const first = requestAnimationFrame(update);
  node.addEventListener("scroll", update, { passive: true });
  return {
    destroy() {
      cancelAnimationFrame(first);
      node.removeEventListener("scroll", update);
    },
  };
}
