<!--
  The list's note in the reading area (decision 0229): while the list isn't
  on screen (an article on a phone, or the list hidden on a computer), what
  was just done is said where the reader is, with its Undo or Try again and
  a × (SPEC section 8), in the same build as the note at the list's foot. It
  floats at the reading area's foot, above a phone's toolbar, and appears at
  once, never sliding. Empty, it stays for screen readers, which hear each
  message as it arrives (the list's own note is hidden with the list).
-->
<script lang="ts">
  import NoteLine from "./NoteLine.svelte";
  import type { ListNote } from "./listNote";

  let { note, onGone }: { note: ListNote | undefined; /** A pressed button has gone: the keyboard's place goes back to the article. */ onGone: () => void } = $props();

  /** Each button's press, then the keyboard's place back in the article, as the button it was on goes. */
  const then = (press: (() => void) | undefined) => press && (() => (press(), onGone()));
</script>

<div class="away" lang="en">
  <div class={["toast pointer-events-auto flex min-h-11 max-w-full items-center border px-4 text-meta", !note && "sr-only"]}>
    <NoteLine announce message={note?.words ?? ""} onUndo={then(note?.undo)} onRetry={then(note?.retry)} retryWord={note?.retryWord} onClose={() => then(note?.close)?.()} />
  </div>
</div>

<style>
  /* Takes no room: the note floats 12px above the reading area's foot, centred, over the text's last lines. */
  .away {
    position: relative;
    z-index: 10;
    height: 0;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }
  .away > .toast {
    position: absolute;
    bottom: 0.75rem;
    max-width: calc(100% - 2rem);
  }
</style>
