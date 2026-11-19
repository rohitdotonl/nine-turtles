<!--
  Everyone the reader follows couldn't be loaded, so nothing that needs them
  can show: the sidebar's people, and every list, person and folder (they're
  drawn from that list). Each place says so once instead of staying blank
  (decision 0318): in the sidebar, and where the list would be. With no
  answer at all, calmly, saying when it comes back (decision 0312); a server
  that answered with an error gets the red line with Try again. Either way it
  asks again by itself once the connection is back.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "./Icon.svelte";
  import LoadFailed from "./LoadFailed.svelte";
  import TextButton from "./TextButton.svelte";
  import { away, connection, whenBack } from "./connection.svelte";

  let {
    where,
    onRetry,
  }: {
    /** The sidebar's line, or the line in the list's place. */
    where: "sidebar" | "list";
    /** Asks for everyone the reader follows again. */
    onRetry: () => Promise<void>;
  } = $props();

  onMount(() => whenBack(() => void onRetry()));
</script>

{#if connection.offline}
  <p role="status" class={where === "sidebar" ? "px-4 pt-4 text-meta text-ink-2" : "mt-4"}>{away().why} Your reading shows {away().back}.</p>
{:else if where === "sidebar"}
  <p role="status" class="flex flex-wrap items-center gap-x-2 px-4 pt-4 text-meta text-danger"><span class="shrink-0"><Icon name="alert" /></span>Everyone you follow couldn't be loaded.<TextButton onclick={() => onRetry().then(() => document.querySelector<HTMLElement>("#sidebar a")?.focus())}>Try again</TextButton></p>
{:else}
  <LoadFailed words="The articles couldn't be loaded." heading="list-heading" onRetry={onRetry} class="mt-4" />
{/if}
