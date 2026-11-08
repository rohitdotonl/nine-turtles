// Dragging in the sidebar (SPEC section 5, decision 0207): a folder up or
// down among the folders, a person or publication onto a folder, out of
// one, or between People and Publications. Pointer events, so a mouse, a
// pen and a finger all work the same way:
//
// - a mouse or pen drags once it has moved a few pixels, so a click that
//   wobbles never moves anything;
// - a finger presses and holds for half a second first, so a swipe still
//   scrolls; a row's handle (in Edit) drags at once, as it never scrolls.
//
// Nothing slides or animates: the row lifted under the pointer, the line
// where a folder will land and the tone on the folder it will go into
// appear and go. Escape, or letting go anywhere else, changes nothing.
//
// The sidebar marks what can move and where it can go with data attributes,
// read here: `data-drag="folder:3"` or `data-drag="person:12:3"` (a person
// in folder 3; nothing after the second colon for one in no folder),
// `data-folder-list` and `data-folder-item="3"` for the folders in order,
// `data-drop-folder="3"` on a folder's row and `data-drop-loose="person"` or
// `"publication"` on the lists under the folders. This file sets
// `data-dragging` (on the page: "folder", "person", or "copy" while Option or
// Ctrl is held), `data-drop` and the line itself; the CSS is in arranging.css.

/** What's being dragged. */
export type Dragged = { kind: "folder"; id: number } | { kind: "person"; id: number; from: number | null };

/** Where it would land. */
export type Over =
  | { kind: "between"; before: number | null }
  | { kind: "folder"; id: number }
  | { kind: "loose"; who: "person" | "publication" }
  | null;

export type DragOptions = {
  /** Whether letting go here would change anything (only then is the place marked). */
  accepts: (dragged: Dragged, over: Over) => boolean;
  /** Let go over a place that accepts it; `keep` is Option (Ctrl off a Mac) held, to copy. */
  drop: (dragged: Dragged, over: Over, keep: boolean) => void;
  /** Over a place that refuses, a sentence saying why, shown beside it; `over` null clears it. `dropped` is true once it's let go there anyway. */
  refuse?: (dragged: Dragged, over: Over, dropped?: boolean) => void;
};

/** How far a mouse moves before a press becomes a drag, and a finger may wander while it holds. */
const MOUSE_SLOP = 4;
export const FINGER_SLOP = 8;
/** How long a finger holds a row before it lifts. */
export const HOLD_MS = 500;
/** How near the sidebar's top or bottom edge the pointer scrolls it, and by how much each frame. */
const EDGE = 40;
const SCROLL_STEP = 10;

const onMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Reads `data-drag` back into what's being dragged. */
export function readDragged(value: string | undefined): Dragged | undefined {
  const [kind, id, from] = (value ?? "").split(":");
  const number = Number(id);
  if (!Number.isInteger(number) || number <= 0) return undefined;
  if (kind === "folder") return { kind, id: number };
  if (kind === "person") return { kind, id: number, from: from ? Number(from) : null };
  return undefined;
}

/** The value for `data-drag`. */
export function dragValue(dragged: Dragged): string {
  return dragged.kind === "folder" ? `folder:${dragged.id}` : `person:${dragged.id}:${dragged.from ?? ""}`;
}

/** Whether a drop copies rather than moves: Option on a Mac, Ctrl elsewhere. */
function copying(event: { altKey: boolean; ctrlKey: boolean }): boolean {
  return onMac ? event.altKey : event.ctrlKey;
}

/** A Svelte action on the sidebar's lists. */
export function sidebarDrag(node: HTMLElement, initial: DragOptions) {
  let options = initial;
  let press: { id: number; x: number; y: number; source: HTMLElement; dragged: Dragged; touch: boolean; handle: boolean } | undefined;
  let holding: ReturnType<typeof setTimeout> | undefined;
  let lifted = false;
  let over: Over = null;
  let marked: HTMLElement | undefined;
  let ghost: HTMLElement | undefined;
  let line: HTMLElement | undefined;
  let pointer = { x: 0, y: 0 };
  let frame = 0;
  let keep = false;

  const scroller = () => node.closest<HTMLElement>(".scroller") ?? document.scrollingElement;

  function down(event: PointerEvent) {
    if (event.button !== 0 || press) return;
    const target = event.target as HTMLElement;
    const source = target.closest<HTMLElement>("[data-drag]");
    if (!source || !node.contains(source)) return;
    // Buttons on a row (a folder's arrow, Edit) do their own thing; a handle is the exception,
    // but not the menu its press opens (Move up…), which is only a menu.
    if (target.closest('[role="menu"]')) return;
    const handle = !!target.closest("[data-handle]");
    if (!handle && target.closest("button")) return;
    const dragged = readDragged(source.dataset.drag);
    if (!dragged) return;
    const touch = event.pointerType === "touch";
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, source, dragged, touch, handle };
    pointer = { x: event.clientX, y: event.clientY };
    if (touch && !handle) holding = setTimeout(lift, HOLD_MS);
  }

  function move(event: PointerEvent) {
    if (!press || event.pointerId !== press.id) return;
    pointer = { x: event.clientX, y: event.clientY };
    keep = copying(event);
    if (!lifted) {
      const far = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (press.touch && !press.handle) {
        // Moved before the hold was up: it's a scroll, not a drag.
        if (far > FINGER_SLOP) end();
        return;
      }
      if (far < MOUSE_SLOP) return;
      lift();
    }
    follow();
  }

  /** The press becomes a drag: the row lifts under the pointer. */
  function lift() {
    holding = undefined;
    if (!press) return;
    lifted = true;
    press.source.dataset.dragging = "";
    document.documentElement.dataset.dragging = press.dragged.kind;
    ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.setAttribute("aria-hidden", "true");
    ghost.textContent = press.source.querySelector<HTMLElement>("[title]")?.title ?? press.source.textContent?.trim() ?? "";
    document.body.append(ghost);
    try {
      node.setPointerCapture(press.id);
    } catch {
      // The pointer was already let go.
    }
    follow();
    frame = requestAnimationFrame(scrollNearEdges);
  }

  function follow() {
    if (!press || !ghost) return;
    ghost.style.left = `${pointer.x + 12}px`;
    ghost.style.top = `${pointer.y + 8}px`;
    document.documentElement.dataset.dragging = keep && press.dragged.kind === "person" ? "copy" : press.dragged.kind;
    over = whereIs(press.dragged);
    mark();
  }

  /** Where the pointer is, as a place to drop on. */
  function whereIs(dragged: Dragged): Over {
    if (dragged.kind === "folder") {
      const items = [...node.querySelectorAll<HTMLElement>("[data-folder-item]")];
      const below = items.find((item) => {
        const box = item.getBoundingClientRect();
        return pointer.y < box.top + Math.min(box.height, 44) / 2;
      });
      return { kind: "between", before: below ? Number(below.dataset.folderItem) : null };
    }
    const under = document.elementFromPoint(pointer.x, pointer.y);
    const folder = under?.closest<HTMLElement>("[data-drop-folder]");
    if (folder && node.contains(folder)) return { kind: "folder", id: Number(folder.dataset.dropFolder) };
    const loose = under?.closest<HTMLElement>("[data-drop-loose]");
    if (loose && node.contains(loose)) return { kind: "loose", who: loose.dataset.dropLoose === "publication" ? "publication" : "person" };
    return null;
  }

  /** Shows where it would land: a line between folders, or a tone on a folder or list. */
  function mark() {
    if (!press) return;
    const accepted = options.accepts(press.dragged, over);
    options.refuse?.(press.dragged, over);
    let target: HTMLElement | undefined;
    if (accepted && over?.kind === "folder") target = node.querySelector<HTMLElement>(`[data-drop-folder="${over.id}"]`) ?? undefined;
    if (accepted && over?.kind === "loose") target = node.querySelector<HTMLElement>(`[data-drop-loose="${over.who}"]`) ?? undefined;
    if (target !== marked) {
      delete marked?.dataset.drop;
      marked = target;
      if (marked) marked.dataset.drop = "";
    }
    drawLine(accepted && over?.kind === "between" ? over.before : undefined);
  }

  /** The line where a dragged folder would land: above `before`, or under the last folder. */
  function drawLine(before: number | null | undefined) {
    const list = node.querySelector<HTMLElement>("[data-folder-list]");
    if (before === undefined || !list) {
      line?.remove();
      line = undefined;
      return;
    }
    const items = [...list.querySelectorAll<HTMLElement>("[data-folder-item]")];
    const anchor = before === null ? items.at(-1) : items.find((item) => Number(item.dataset.folderItem) === before);
    if (!anchor) return;
    line ??= Object.assign(document.createElement("div"), { className: "drop-line" });
    line.setAttribute("aria-hidden", "true");
    const box = anchor.getBoundingClientRect();
    const top = (before === null ? box.bottom : box.top) - list.getBoundingClientRect().top;
    line.style.top = `${top - 1}px`;
    if (line.parentElement !== list) list.append(line);
  }

  /** Holding the row near the top or bottom of the sidebar scrolls it, to reach a folder out of sight. */
  function scrollNearEdges() {
    if (!lifted) return;
    const area = scroller();
    if (area) {
      const box = area === document.scrollingElement ? { top: 0, bottom: innerHeight } : area.getBoundingClientRect();
      const step = pointer.y < box.top + EDGE ? -SCROLL_STEP : pointer.y > box.bottom - EDGE ? SCROLL_STEP : 0;
      if (step) {
        area.scrollTop += step;
        over = press ? whereIs(press.dragged) : null;
        mark();
      }
    }
    frame = requestAnimationFrame(scrollNearEdges);
  }

  function up(event: PointerEvent) {
    if (!press || event.pointerId !== press.id) return;
    if (lifted) {
      const { dragged } = press;
      const here = over;
      const accepted = options.accepts(dragged, here);
      swallowClick();
      end();
      if (accepted) options.drop(dragged, here, copying(event));
      else options.refuse?.(dragged, here, true);
      return;
    }
    end();
  }

  /** The click that follows letting go of a dragged link would open it: it's dropped. */
  function swallowClick() {
    const stop = (click: Event) => {
      click.preventDefault();
      click.stopPropagation();
    };
    window.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
  }

  function end() {
    clearTimeout(holding);
    holding = undefined;
    cancelAnimationFrame(frame);
    if (press) delete press.source.dataset.dragging;
    delete document.documentElement.dataset.dragging;
    delete marked?.dataset.drop;
    marked = undefined;
    ghost?.remove();
    ghost = undefined;
    line?.remove();
    line = undefined;
    if (press && lifted) options.refuse?.(press.dragged, null);
    press = undefined;
    lifted = false;
    over = null;
  }

  function key(event: KeyboardEvent) {
    if (!lifted) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      end();
      return;
    }
    keep = copying(event);
    follow();
  }

  /** While a finger holds or drags a row, the page doesn't scroll under it. */
  function touchMove(event: TouchEvent) {
    if (lifted || (press?.touch && press.handle)) event.preventDefault();
  }

  /** A finger held on a link would bring up the browser's own menu. */
  function menu(event: Event) {
    if (press?.touch) event.preventDefault();
  }

  /** A link or picture's own drag (the browser's) never starts: this one does instead. */
  function nativeDrag(event: DragEvent) {
    if ((event.target as HTMLElement | null)?.closest?.("[data-drag]")) event.preventDefault();
  }

  node.addEventListener("pointerdown", down);
  node.addEventListener("dragstart", nativeDrag);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", end);
  node.addEventListener("touchmove", touchMove, { passive: false });
  node.addEventListener("contextmenu", menu);
  window.addEventListener("keydown", key, true);
  window.addEventListener("keyup", key, true);
  return {
    update(next: DragOptions) {
      options = next;
    },
    destroy() {
      end();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("dragstart", nativeDrag);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", end);
      node.removeEventListener("touchmove", touchMove);
      node.removeEventListener("contextmenu", menu);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keyup", key, true);
    },
  };
}
