<!--
  While feeds brought from a file wait for their first check (decision 0249),
  Unread and All articles say how many are left, in words that change in
  place, never a bar or a spinner: a quiet line above the rows, or, while
  nothing has come yet, in place of "Nothing unread.". Once every one is
  checked, the line says how they were sorted (decision 0264): "Your list is
  in: 18 people and 4 publications. 8 could be either." with Look them over
  (Everyone you follow) and a ×, either ending it for good, as Undo the
  import does.
-->
<script lang="ts">
  import { checkingLine } from "./listWording";
  import NoteLine from "./NoteLine.svelte";
  import { sortedLine, type SortedLine } from "./sorting";

  let { left, nothingYet, sorted }: { left: number; nothingYet: boolean; sorted?: SortedLine } = $props();

  /** × on the line: it goes, and the keyboard's place goes to the list's title. */
  function close() {
    sorted?.onClose();
    document.getElementById("list-heading")?.focus({ preventScroll: true });
  }
</script>

{#if left === 0 && sorted}
  <div class="pt-1 pb-2 text-meta"><NoteLine announce message={sortedLine(sorted.counts)} also={[{ word: "Look them over", press: sorted.onLookOver }]} onClose={close} /></div>
{:else if nothingYet}
  <div class="list-empty"><p class="list-empty-fact">{checkingLine(left)}</p><p class="list-empty-how">Their articles show here as each one is checked.</p></div>
{:else}
  <p class="pt-1 pb-2 text-meta text-muted">{checkingLine(left)}</p>
{/if}
