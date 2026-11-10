<!--
  A note as the reader wrote it, line breaks kept (SPEC section 42). On a
  video or a podcast's episode, each time in it ("12:34") is a button that
  takes the player back there; elsewhere a time is just words.
-->
<script lang="ts">
  import { withTimes } from "./highlights";

  let { note, jump }: { note: string; jump?: (seconds: number) => void } = $props();
</script>

<p class="note-text">
  {#each withTimes(note) as piece, index (index)}{#if "seconds" in piece && jump}<button type="button" class="time" aria-label="Play from {piece.text}" onclick={() => jump(piece.seconds)}
        >{piece.text}</button
      >{:else}{piece.text}{/if}{/each}
</p>

<style>
  .note-text {
    margin: 0;
    color: var(--ink);
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  /*
    A time: the note's own words, underlined like a link and in the same ink,
    with room around it to press (the line's height, and a little either
    side); never the accent, which marks only what's unread or found.
  */
  .time {
    display: inline;
    padding: 0.75rem 0.25rem;
    margin: -0.75rem -0.25rem;
    color: inherit;
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }
</style>
