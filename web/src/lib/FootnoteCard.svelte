<script lang="ts">
  // A footnote shown where it's pressed (decision 0247, footnotes.ts): a small
  // card under the line, at the column's width, scrolling with the text. The
  // keyboard goes into it; Escape, × or a press anywhere else closes it, and
  // Escape and × give the keyboard back to the footnote's number. It doesn't
  // move or fade: it's there, then gone.
  import Icon from "./Icon.svelte";
  import type { Footnote } from "./footnotes";
  import { dismissOn } from "./dismiss";

  let { note, top, onclose }: { note: Footnote; top: number; onclose: (returnFocus: boolean) => void } = $props();
  let card: HTMLElement | undefined = $state();

  // Escape or a press anywhere else closes it (dismiss.ts). It opens in view,
  // moving the page no more than it must, and closes if the column's width
  // changes (a new text size, a resized window), as it would sit over the
  // wrong line.
  $effect(() => {
    if (!card) return;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: "nearest" });
    const stop = dismissOn(() => card, onclose);
    const column = card.parentElement?.closest("article");
    let width = column?.clientWidth;
    const resized = new ResizeObserver(() => {
      if (column && column.clientWidth !== width) onclose(false);
      width = column?.clientWidth;
    });
    if (column) resized.observe(column);
    return () => {
      stop();
      resized.disconnect();
    };
  });
</script>

<div
  bind:this={card}
  class="footnote-card floating"
  role="dialog"
  aria-label="Footnote {note.number}"
  tabindex="-1"
  style:top="{top}px"
  onfocusout={(event) => {
    // The keyboard moving on past it (Tab) closes it; leaving the window doesn't.
    if (event.relatedTarget instanceof Node && !card?.contains(event.relatedTarget)) onclose(false);
  }}
>
  <!-- The note as the article has it, cleaned before it was stored (server/src/feed/clean.rs), after its number on the same line, set as the article's text is. -->
  <div class="footnote-words article-text"><span class="footnote-number" aria-hidden="true">{note.number}</span>{@html note.html}</div>
  <button type="button" class="btn-quiet btn-icon footnote-close" aria-label="Close" title="Close" onclick={() => onclose(true)}><Icon name="close" size="alone" /></button>
</div>

<style>
  /* The family of things that float (.floating in app.css): its corners, edge and shadow. */
  .footnote-card {
    position: absolute;
    z-index: 5;
    inset-inline: -1rem;
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    padding: 0.25rem 0.25rem 0.75rem 1rem;
    font-size: 0.85em;
    line-height: 1.5;
  }
  .footnote-number {
    float: inline-start;
    margin-inline-end: 0.5em;
    font-family: var(--font-sans);
    font-weight: 600;
    color: var(--ink-2);
  }
  .footnote-words {
    flex: 1;
    min-width: 0;
    padding-top: 0.5rem;
  }
  .footnote-words > :global(:first-child),
  .footnote-words > .footnote-number + :global(*) {
    margin-top: 0;
  }
  .footnote-words :global(:last-child) {
    margin-bottom: 0;
  }
  .footnote-close {
    flex: none;
  }
</style>
