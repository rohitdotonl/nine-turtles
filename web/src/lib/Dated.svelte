<script lang="ts">
  // A sentence whose dates take the face with a plain zero (dated.ts).
  import { datedParts } from "./dated";

  let { text }: { text: string } = $props();
</script>

{#each datedParts(text) as part, i (i)}{#if part.date}<span class="dated">{part.text}</span>{:else}{part.text}{/if}{/each}
