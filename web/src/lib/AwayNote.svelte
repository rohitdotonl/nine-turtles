<!--
  The list's note in the reading area (decision 0229): while the list isn't
  on screen (an article on a phone, or the list hidden on a computer), what
  was just done is said where the reader is, with its Undo or Try again and
  a × (SPEC section 8), in the same build as the note at the list's foot. Write back's
  "Opening your email app…", started while its own line is off screen, is said here too
  (SPEC section 37), and on a computer the article's own lines ("Link copied.",
  "Highlighted.") since its top bar scrolls away (decision 0263). It
  floats at the reading area's foot, above a phone's toolbar, and appears at
  once, never sliding. Empty, it stays for screen readers, which hear each
  message as it arrives (the list's own note is hidden with the list).
-->
<script lang="ts">
  import { tick } from "svelte";
  import NoteLine from "./NoteLine.svelte";
  import type { ListNote } from "./listNote";

  let { note, onGone }: { note: ListNote | undefined; /** A pressed button has gone: the keyboard's place goes back to the article. */ onGone: () => void } = $props();

  /** Each button's press, then the keyboard's place back in the article, as the button it was on goes. */
  const then = (press: (() => void) | undefined) => press && (() => (press(), onGone()));

  let box: HTMLDivElement | undefined = $state();
  /** A press that opens more of the note (Write back's "Didn't open?"): the keyboard stays in the note, on the first of what it opened. */
  async function more(press: () => void) {
    press();
    await tick();
    box?.querySelector("button")?.focus();
  }
  const opening = (press: (() => void) | undefined) => press && (() => void more(press));
</script>

<div bind:this={box} class="away" lang="en">
  <div class={["toast pointer-events-auto flex max-w-full items-center text-meta", note ? "min-h-11 border px-4" : "sr-only"]}>
    <NoteLine announce message={note?.words ?? ""} refusal={note?.refusal} also={note?.also?.map((way) => ({ word: way.word, press: then(way.press) ?? way.press }))} onUndo={then(note?.undo)} onRetry={(note?.retryOpens ? opening : then)(note?.retry)} retryWord={note?.retryWord} onClose={() => then(note?.close)?.()} />
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
