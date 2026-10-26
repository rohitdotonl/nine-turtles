<!--
  The quiet line under "Check your email" (SPEC section 1): "Didn't get it?"
  For the first minute after a link is sent it only says to look in the spam
  folder and that another can be sent in a minute; then Send again appears
  (its room kept until then), a link in words. The line changes once, when the minute is up, and isn't
  announced; pressing Send again says what happened and starts the minute
  over. The server sends one link of a kind a minute anyway (decision 0091).
-->
<script lang="ts">
  import { RESEND_AFTER_SECONDS } from "./accounts";

  let {
    onSend,
  }: {
    /** Sends the link again; answers what to say ("Another link is on its way." or why not). */
    onSend: () => Promise<string>;
  } = $props();

  let ready = $state(false);
  let busy = $state(false);
  let note = $state("");
  let line: HTMLParagraphElement | undefined = $state();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function wait() {
    ready = false;
    clearTimeout(timer);
    timer = setTimeout(() => (ready = true), RESEND_AFTER_SECONDS * 1000);
  }

  $effect(() => {
    wait();
    return () => clearTimeout(timer);
  });

  async function again() {
    if (busy || !ready) return;
    busy = true;
    note = await onSend();
    busy = false;
    wait();
    // The button goes for a minute: the keyboard stays on the line that replaced it.
    line?.focus();
  }
</script>

<div class="flex flex-col items-center gap-1 text-center">
  <p role="status" class={["text-small", !note && "sr-only"]}>{note}</p>
  <p bind:this={line} tabindex="-1" class="text-small text-muted">
    Didn't get it? Look in your spam folder{#if !ready}, or send it again in a minute.{:else}.{/if}
  </p>
  <!-- Its room is kept while it's hidden, so nothing on the centred page moves when it appears. -->
  <button type="button" onclick={again} aria-disabled={busy} class={["text-link", !ready && "invisible"]}>Send again</button>
</div>
