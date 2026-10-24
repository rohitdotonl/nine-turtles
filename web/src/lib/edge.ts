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
  update();
  node.addEventListener("scroll", update, { passive: true });
  return {
    destroy() {
      node.removeEventListener("scroll", update);
    },
  };
}
