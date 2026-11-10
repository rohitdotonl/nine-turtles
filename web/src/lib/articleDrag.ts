// Picking up an article (SPEC section 6, decision 0250): on a computer, a
// row of the list can be dragged. It carries the publisher's own link
// (never nine turtles' address), so dropped in a note, an email or another
// tab it's their page that goes, credited to them. Dropped on Starred in the
// sidebar, it's starred, as `s` does, with the list's note and its Undo.
//
// Native drag and drop, as only a fine pointer has: a finger's press and hold
// is the row's menu (longPress.ts), which stars too. While a row is held,
// the page carries `data-dragging="article"` (so linkDrop.svelte.ts leaves
// it alone) and Starred, under the pointer, takes the drop tone
// (arranging.css), unless the article is starred already.

import { dropMarker, liftedCopy } from "./dropMark";
import type { Article } from "./shapes";

/** The kind of drag only a row of this list makes: its article's id. */
const ARTICLE = "application/x-nine-turtles-article";

/** The article being dragged from the list, while it is. */
let held: Article | undefined;

const fine = () => typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;

/** What a dragged row carries: the publisher's link, as a link and as text, and its id for Starred. */
export function carried(article: Pick<Article, "id" | "link">): [string, string][] {
  const link = article.link?.startsWith("http") ? article.link : undefined;
  return [...(link ? ([["text/uri-list", link], ["text/plain", link]] as [string, string][]) : []), [ARTICLE, String(article.id)]];
}

/** A list row: draggable on a computer, carrying `article()`. */
export function carriesArticle(row: HTMLElement, article: () => Article) {
  if (!fine()) return;
  row.draggable = true;
  const start = (event: DragEvent) => {
    const transfer = event.dataTransfer;
    if (!transfer) return;
    held = article();
    for (const [type, value] of carried(held)) transfer.setData(type, value);
    transfer.effectAllowed = "copyLink";
    // The lifted copy: the title, in the sidebar's lifted name's look.
    const ghost = liftedCopy(held.title || "Untitled");
    ghost.style.top = "-100px";
    transfer.setDragImage(ghost, 12, 12);
    setTimeout(() => ghost.remove(), 0);
    document.documentElement.dataset.dragging = "article";
    // The row stays in its place, faded, as a sidebar row does while held.
    row.dataset.dragging = "";
  };
  const end = () => {
    held = undefined;
    delete row.dataset.dragging;
    if (document.documentElement.dataset.dragging === "article") delete document.documentElement.dataset.dragging;
  };
  row.addEventListener("dragstart", start);
  row.addEventListener("dragend", end);
  return {
    destroy() {
      row.removeEventListener("dragstart", start);
      row.removeEventListener("dragend", end);
    },
  };
}

/** Listens for a row let go on Starred (`[data-drop-star]`); `star` stars it. Returns what stops listening. */
export function listenForStarring(star: (id: number) => void): () => void {
  const { mark } = dropMarker();
  const starTarget = (event: DragEvent) =>
    held && !held.starred && event.dataTransfer?.types.includes(ARTICLE) && event.target instanceof Element
      ? (event.target.closest<HTMLElement>("[data-drop-star]") ?? undefined)
      : undefined;
  const over = (event: DragEvent) => {
    const target = starTarget(event);
    mark(target);
    if (!target) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };
  const drop = (event: DragEvent) => {
    const target = starTarget(event);
    const id = Number(event.dataTransfer?.getData(ARTICLE));
    mark(undefined);
    if (!target || !id) return;
    event.preventDefault();
    star(id);
  };
  const clear = () => mark(undefined);
  window.addEventListener("dragover", over);
  window.addEventListener("drop", drop);
  window.addEventListener("dragend", clear);
  return () => {
    clear();
    window.removeEventListener("dragover", over);
    window.removeEventListener("drop", drop);
    window.removeEventListener("dragend", clear);
  };
}
