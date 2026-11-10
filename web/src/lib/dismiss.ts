// Something small that floats over the page (a highlight's menu, a
// footnote's card) closes when it's done with: a press anywhere outside it,
// or Escape wherever the keyboard is. Escape closing it goes no further, so
// it doesn't also leave the article. `returnFocus` says whether the keyboard
// should go back where it came from: yes for Escape, no for a press elsewhere,
// which puts the keyboard where it was pressed.

/** Listens for a press outside `inside()` and for Escape; answers the way to stop listening. */
export function dismissOn(inside: () => Node | undefined, close: (returnFocus: boolean) => void): () => void {
  const away = (event: PointerEvent) => {
    const box = inside();
    if (box && event.target instanceof Node && !box.contains(event.target)) close(false);
  };
  const escape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  };
  document.addEventListener("pointerdown", away, true);
  window.addEventListener("keydown", escape, true);
  return () => {
    document.removeEventListener("pointerdown", away, true);
    window.removeEventListener("keydown", escape, true);
  };
}
