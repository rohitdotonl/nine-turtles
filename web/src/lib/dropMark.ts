// What every way of dropping in nine turtles shares (sidebarDrag.ts,
// linkDrop.svelte.ts, articleDrag.ts): one place at a time takes the drop
// tone (`data-drop`, read by arranging.css), and the lifted copy that goes
// with the pointer is the same small card.

/** The one place marked as where letting go would land: `mark` moves the tone there (undefined clears it). */
export function dropMarker() {
  let marked: HTMLElement | undefined;
  return {
    get marked() {
      return marked;
    },
    mark(target: HTMLElement | undefined) {
      if (target === marked) return;
      delete marked?.dataset.drop;
      marked = target;
      if (marked) marked.dataset.drop = "";
    },
  };
}

/** The lifted copy: `text` on the floating surface, in the page, unseen by screen readers (which hear the drop's note). */
export function liftedCopy(text: string): HTMLElement {
  const copy = document.createElement("div");
  copy.className = "drag-ghost";
  copy.setAttribute("aria-hidden", "true");
  copy.textContent = text;
  document.body.append(copy);
  return copy;
}
