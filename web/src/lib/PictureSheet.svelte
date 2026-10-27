<!--
  A picture from an article, opened larger (SPEC section 7, decision 0107):
  alone on a plain card over the dimmed page, as large as fits with a margin
  all round (never larger than it really is), its alt text under it as a
  caption in the second ink, and a quiet "Open in new tab" to the picture's
  own address. It's a picture you only look at, so it closes with an X
  (DESIGN.md → "One close rule"), Escape, or a press on the dim; the page
  then gives the keyboard back to the picture (or to the article's title, if
  it no longer opens larger). The sheet is drawn outside the article, so it
  carries the article's language itself, as the article does, and its own
  English words say theirs. A native modal dialog, like
  the shortcut list, so the keyboard stays inside while it's open. It appears
  at once and goes at once: nothing moves. Nothing stops a phone's pinch-zoom.

  By night it shows the picture at full brightness: the dimming in the
  article (app.css) is there so a pale picture doesn't glare beside the
  text, and here the reader asked to look at the picture itself.
-->
<script lang="ts">
  import Icon from "./Icon.svelte";

  let {
    src,
    alt,
    lang,
    onClose,
  }: {
    /** The picture's address, as the article loaded it. */
    src: string;
    /** The publisher's description of the picture, shown as its caption; empty when there's none. */
    alt: string;
    /** The article's language: the sheet is drawn outside the article, so its caption and name say it themselves. */
    lang?: string;
    onClose: () => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  const caption = $derived(alt.trim());

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });

  /** The dialog closes first, so the page behind can take the keyboard again; the page then gives it back to the picture. */
  function close() {
    dialog?.close();
    onClose();
  }

  /** Escape. */
  function cancel(event: Event) {
    event.preventDefault();
    close();
  }

  /** A press on the dim around the card closes it, but only if it began there too. */
  let pressedOutside = false;
  function outside(event: MouseEvent) {
    if (pressedOutside && event.target === dialog) close();
    pressedOutside = false;
  }
</script>

<dialog
  bind:this={dialog}
  aria-label={caption ? `Picture: ${caption}` : "Picture"}
  {lang}
  oncancel={cancel}
  onpointerdown={(event) => (pressedOutside = event.target === dialog)}
  onclick={outside}
  class="picture-sheet floating dimmed m-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-auto p-0 text-ink"
>
  <div class="flex flex-col items-center px-4 pb-3">
    <div class="flex w-full justify-end pt-1">
      <button type="button" onclick={close} lang="en" aria-label="Close" title="Close (Esc)" class="btn-quiet btn-icon -mr-2"><Icon name="close" size={18} /></button>
    </div>
    <figure class="m-0 flex flex-col items-center">
      <!-- Its alt text is the caption below, so the picture itself isn't named twice. -->
      <img {src} alt="" class="picture-sheet-image" />
      {#if caption}
        <figcaption class="mt-2 max-w-[60ch] text-center text-small text-ink-2">{caption}</figcaption>
      {/if}
    </figure>
    <a href={src} lang="en" target="_blank" rel="noopener noreferrer" class="picture-sheet-link text-small text-ink-2">Open in new tab</a>
  </div>
</dialog>

<style>
  /*
    As large as fits: the window less the card's margin and padding, the X's
    line above and the caption and link below; never stretched past its own
    size, so it stays sharp.
  */
  .picture-sheet-image {
    display: block;
    width: auto;
    height: auto;
    max-width: calc(100vw - 4rem);
    max-height: calc(100dvh - 13rem);
  }
  /* A quiet text link, 44px tall to press, its underline softer than its words but still 3 : 1 on the card. */
  .picture-sheet-link {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    text-decoration-color: color-mix(in srgb, currentColor 65%, transparent);
  }
  .picture-sheet-link:hover {
    color: var(--ink);
    text-decoration-color: currentColor;
  }
</style>
