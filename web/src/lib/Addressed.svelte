<script lang="ts">
  // A sentence whose addresses keep the crossed zero (addressed.ts).
  import { addressParts } from "./addressed";

  let { text }: { text: string } = $props();
</script>

{#each addressParts(text) as part, i (i)}{#if part.address}<span class="address">{part.text}</span>{:else}{part.text}{/if}{/each}
