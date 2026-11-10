<!--
  While feeds brought from a file wait for their first check (decision 0249),
  Unread and All articles say how many are left, in words that change in
  place, never a bar or a spinner: a quiet line above the rows, or, while
  nothing has come yet, in place of "Nothing unread.".
-->
<script lang="ts">
  import { checkingLine } from "./listWording";

  let { left, nothingYet }: { left: number; nothingYet: boolean } = $props();
</script>

{#if nothingYet}
  <div class="list-empty"><p class="list-empty-fact">{checkingLine(left)}</p><p class="list-empty-how">Their articles show here as each one is checked.</p></div>
{:else}
  <p class="pt-1 pb-2 text-meta text-muted">{checkingLine(left)}</p>
{/if}
