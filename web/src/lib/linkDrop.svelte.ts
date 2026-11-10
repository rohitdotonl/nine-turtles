// Following by dropping (SPEC section 3, decision 0247): a link dragged out
// of an article, or a page's address dragged from another browser tab,
// dropped anywhere on nine turtles opens "Follow <name>?" for it, as a page
// shared here does; dropped on a folder, whoever is followed goes into that
// folder too. A list of feeds (an OPML file) dropped the same way is
// imported. Nothing is visited until the question opens, exactly as if the
// address had been pasted into + Add.
//
// While something that can be dropped is held over the window, the page
// says so (`data-dragging="link"` or `"file"` on the page, read by
// arranging.css) and the folder under the pointer takes the drop tone, as
// when a person is dragged onto it (sidebarDrag.ts). A drop into a text
// field, or while a sheet is open, is the browser's own.

/** The folder a link was dropped on, for "Follow <name>?" to file them in once followed. */
export const droppedOn: { folder: { id: number; name: string } | null } = $state({ folder: null });

/** The first web address a drag carries (a link, or another tab's address), unless it's one of nine turtles' own. */
export function droppedAddress(data: Pick<DataTransfer, "getData"> | null, own = location.origin): string | undefined {
  const first = (data?.getData("text/uri-list") ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== "" && !line.startsWith("#"));
  if (!first) return undefined;
  try {
    const url = new URL(first);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== own) return url.href;
  } catch {
    // Not an address.
  }
  return undefined;
}

/** A dropped file that could be a list of feeds (.opml, or the .xml some readers export). */
export function feedListFile(files: ArrayLike<File> | undefined): File | undefined {
  const file = files?.[0];
  return file && /\.(opml|xml)$/i.test(file.name) ? file : undefined;
}

/** What a drag holds, from its types alone (its contents can't be read until it's dropped). */
export function holding(types: readonly string[] | undefined): "link" | "file" | undefined {
  if (!types) return undefined;
  if (types.includes("Files")) return "file";
  if (types.includes("text/uri-list")) return "link";
  return undefined;
}

export type LinkDropOptions = {
  /** A web address was dropped: on the folder `folder`, or anywhere else (null). */
  onLink: (address: string, folder: number | null) => void;
  /** A list of feeds was dropped. */
  onFile: (file: File) => void;
};

/** Listens on the whole window; returns what stops listening. */
export function listenForDrops(options: LinkDropOptions): () => void {
  const page = document.documentElement;
  let marked: HTMLElement | undefined;

  const ours = () => page.dataset.dragging === "link" || page.dataset.dragging === "file";
  // A person being arranged, an open sheet, or a text field: not ours to take.
  const elsewhere = (target: EventTarget | null) =>
    (page.dataset.dragging !== undefined && !ours()) ||
    document.querySelector("dialog[open]") !== null ||
    (target instanceof Element && target.closest("input, textarea, [contenteditable]") !== null);

  function mark(folder: HTMLElement | undefined) {
    if (folder === marked) return;
    delete marked?.dataset.drop;
    marked = folder;
    if (marked) marked.dataset.drop = "";
  }

  function clear() {
    if (ours()) delete page.dataset.dragging;
    mark(undefined);
  }

  function over(event: DragEvent) {
    const kind = holding(event.dataTransfer?.types);
    if (!kind || elsewhere(event.target)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    page.dataset.dragging = kind;
    const folder = kind === "link" && event.target instanceof Element ? event.target.closest<HTMLElement>("#sidebar [data-drop-folder]") : null;
    mark(folder ?? undefined);
  }

  function leave(event: DragEvent) {
    // Out of the window altogether.
    if (event.relatedTarget === null) clear();
  }

  function drop(event: DragEvent) {
    if (!ours()) return;
    event.preventDefault();
    const folder = marked ? Number(marked.dataset.dropFolder) : null;
    clear();
    const file = feedListFile(event.dataTransfer?.files);
    if (file) return options.onFile(file);
    const address = droppedAddress(event.dataTransfer);
    if (address) options.onLink(address, folder);
  }

  window.addEventListener("dragover", over);
  window.addEventListener("dragleave", leave);
  window.addEventListener("drop", drop);
  window.addEventListener("dragend", clear);
  return () => {
    clear();
    window.removeEventListener("dragover", over);
    window.removeEventListener("dragleave", leave);
    window.removeEventListener("drop", drop);
    window.removeEventListener("dragend", clear);
  };
}
