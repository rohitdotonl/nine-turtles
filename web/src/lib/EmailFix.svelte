<!--
  "Did you mean asha.rao@gmail.com? Use that": the one quiet line offered
  under an email field when the part after the @ looks like a slip of a
  well-known provider (decision 0234). In the text color, the address in
  semibold, and Use that as the usual button in a line of words: no color,
  no edge. Nothing changes until it's pressed. The line is always there for
  screen readers, empty until there's something to offer, so they hear it
  arrive; it takes room only then.
-->
<script lang="ts">
  import TextButton from "./TextButton.svelte";

  let {
    id,
    fix,
    onUse,
    centred = false,
  }: {
    id: string;
    fix: string | undefined;
    onUse: (email: string) => void;
    /** On the sign-in page, centred under the message it adds to. */
    centred?: boolean;
  } = $props();
</script>

<div {id} aria-live="polite" class={["flex flex-wrap items-center gap-x-2 text-small", centred && "justify-center text-center", !fix && "sr-only"]}>
  {#if fix}
    <span class="min-w-0 break-words">Did you mean <span class="font-semibold">{fix}</span>?</span>
    <TextButton onclick={() => onUse(fix)}>Use that</TextButton>
  {/if}
</div>
